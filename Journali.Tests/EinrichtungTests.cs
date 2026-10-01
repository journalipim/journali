using System.Net.Sockets;
using Journali.Server;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Journali.Tests;

/// <summary>
/// Einrichtung: wohin der Server sich verbindet (Dialog vor Umgebung), was ein Fehler beim Verbinden bedeutet,
/// der Einrichtungscode — und wie die Anmeldung steht (erster Administrator, Passwort festlegen, normal).
/// </summary>
public class EinrichtungTests
{
    private static string Dir() { var d = Path.Combine(Path.GetTempPath(), "journali-einr-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(d); return d; }
    private static IConfiguration Umgebung(string? db, string? pw = null) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["JOURNALI_DB"] = db, ["JOURNALI_DB_PASSWORD"] = pw }).Build();

    [Fact]
    public void Die_Verbindung_handelt_kein_Kerberos_aus()
    {
        // das Laufzeit-Image hat libgssapi_krb5 nicht; Npgsql würde beim Verbindungsaufbau GSS versuchen und mit „Cannot load library“ scheitern
        var z = new DbZiel("Host=db;Port=7432;Database=j;Username=postgres", "geheim", DbZiel.AusUmgebung);
        var b = new Npgsql.NpgsqlConnectionStringBuilder(z.ConnectionString());
        Assert.Equal(Npgsql.GssEncryptionMode.Disable, b.GssEncryptionMode);
        Assert.Equal(Npgsql.GssEncryptionMode.Disable, new Npgsql.NpgsqlConnectionStringBuilder(z.ConnectionString(5)).GssEncryptionMode);
    }

    [Fact]
    public void Das_Passwort_steht_nie_in_der_Verbindungszeichenfolge()
    {
        var z = new DbZiel("Host=db;Port=7432;Database=j;Username=postgres;Password=aus-der-zeichenfolge", null, DbZiel.AusUmgebung);
        Assert.DoesNotContain("aus-der-zeichenfolge", z.Verbindung);
        Assert.Equal("aus-der-zeichenfolge", z.Password);
        Assert.Contains("aus-der-zeichenfolge", z.ConnectionString());
        Assert.Equal(("db", 7432, "j", "postgres"), (z.Host, z.Port, z.Database, z.User));
    }

    [Fact]
    public void Der_Dialog_gilt_vor_der_Umgebung_und_das_Passwort_liegt_nicht_im_Klartext()
    {
        var dir = Dir();
        var env = Umgebung("Host=alt;Port=5432;Database=j;Username=postgres", "falsch");
        Assert.Equal(DbZiel.AusUmgebung, DbZielDatei.Effektiv(dir, env)!.Quelle);

        DbZielDatei.Schreib(dir, new DbZiel("Host=neu;Port=7432;Database=j;Username=postgres;SSL Mode=Require", "richtig-und-geheim", DbZiel.AusDatei));
        Assert.DoesNotContain("richtig-und-geheim", File.ReadAllText(DbZielDatei.PathOf(dir)));
        var z = DbZielDatei.Effektiv(dir, env)!;
        Assert.Equal((DbZiel.AusDatei, "neu", "richtig-und-geheim"), (z.Quelle, z.Host, z.Password));
        Assert.Contains("SSL Mode=Require", z.Verbindung);   // Zusätze bleiben erhalten

        DbZielDatei.Verwerfen(dir);
        Assert.Equal("alt", DbZielDatei.Effektiv(dir, env)!.Host);
        Assert.Null(DbZielDatei.Effektiv(dir, Umgebung(null)));   // weder Dialog noch Umgebung: keine Datenbank
    }

    [Fact]
    public void Im_Paket_kommt_das_Passwort_aus_der_Datei_die_der_erste_Start_erzeugt()
    {
        var dir = Dir(); var f = Path.Combine(dir, "db-password");
        File.WriteAllText(f, "aus-der-datei" + Environment.NewLine);
        var cfg = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["JOURNALI_DB"] = "Host=db;Database=journali;Username=postgres", ["JOURNALI_DB_PASSWORD"] = "", ["JOURNALI_DB_PASSWORD_FILE"] = f }).Build();
        Assert.Equal("aus-der-datei", DbZielDatei.Umgebung(cfg)!.Password);
        // steht es direkt da, gilt das
        var direkt = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["JOURNALI_DB"] = "Host=db;Database=journali;Username=postgres", ["JOURNALI_DB_PASSWORD"] = "direkt", ["JOURNALI_DB_PASSWORD_FILE"] = f }).Build();
        Assert.Equal("direkt", DbZielDatei.Umgebung(direkt)!.Password);
    }

    [Fact]
    public void Ein_leeres_Passwort_im_Dialog_behaelt_das_bisherige_nur_bei_gleichem_Host_und_Anwender()
    {
        var bisher = new DbZiel("Host=db;Port=5432;Database=j;Username=postgres", "alt", DbZiel.AusUmgebung);
        Assert.Equal("alt", DbZiel.Aus(bisher, "db", 7432, "j", "postgres", "", DbZiel.AusDatei).Password);
        Assert.Null(DbZiel.Aus(bisher, "anderer", 5432, "j", "postgres", "", DbZiel.AusDatei).Password);
        Assert.Equal("neu", DbZiel.Aus(bisher, "db", 5432, "j", "postgres", "neu", DbZiel.AusDatei).Password);
    }

    [Theory]
    [InlineData(SocketError.HostNotFound, "host")]
    [InlineData(SocketError.ConnectionRefused, "port")]
    [InlineData(SocketError.TimedOut, "timeout")]
    public void Nicht_erreichbar_sagt_warum(SocketError fehler, string grund)
    {
        var (lage, g, _) = Einrichtung.Einordnen(new NpgsqlException("x", new SocketException((int)fehler)));
        Assert.Equal((DbLage.Unerreichbar, grund), (lage, g));
    }

    [Fact]
    public void Falsches_Passwort_und_fehlende_Rechte_sind_keine_Frage_der_Erreichbarkeit()
    {
        Assert.Equal(DbLage.Abgewiesen, Einrichtung.Einordnen(new PostgresException("password authentication failed", "FATAL", "FATAL", "28P01")).Lage);
        Assert.Equal(DbLage.Rechte, Einrichtung.Einordnen(new PostgresException("permission denied to create database", "ERROR", "ERROR", "42501")).Lage);
        Assert.Equal(DbLage.Unerreichbar, Einrichtung.Einordnen(new TimeoutException()).Lage);
        Assert.Equal(DbLage.Fehler, Einrichtung.Einordnen(new InvalidOperationException("irgendwas")).Lage);
    }

    [Fact]
    public async Task Einrichtungscode_ohne_Gross_klein_und_Strich_und_nur_solange_er_offen_ist()
    {
        Einrichtungscode.Setze("K7M3-Q9TX");
        Assert.True(await Einrichtungscode.PruefeAsync("k7m3q9tx"));
        Assert.True(await Einrichtungscode.PruefeAsync(" K7M3-Q9TX "));
        Assert.False(await Einrichtungscode.PruefeAsync("K7M3-Q9TY"));
        Assert.False(await Einrichtungscode.PruefeAsync(null));
        Einrichtungscode.Setze(null);
        Assert.False(await Einrichtungscode.PruefeAsync("K7M3-Q9TX"));
    }

    [Fact]
    public void Der_Code_liegt_im_Datenverzeichnis_bis_die_Einrichtung_erledigt_ist()
    {
        var dir = Dir();
        Einrichtungscode.Setze(null);
        var code = Einrichtungscode.Aktiv(dir);
        Assert.Matches("^[A-Z2-9]{4}-[A-Z2-9]{4}$", code);
        Assert.Equal(code, Einrichtungscode.Aktiv(dir));   // einer je Lauf
        Assert.Equal(code, File.ReadAllText(Einrichtungscode.PathOf(dir)).Trim());
        Einrichtungscode.Erledigt(dir);
        Assert.False(File.Exists(Einrichtungscode.PathOf(dir)));
        Assert.False(Einrichtungscode.Offen);
    }

    [Fact]
    public void Anmeldung_erster_Administrator_Passwort_festlegen_oder_normal()
    {
        Assert.Equal(Auth.Anmeldung.Einrichten, Auth.Bestimme(false, [], _ => false));
        Assert.Equal(Auth.Anmeldung.Festlegen, Auth.Bestimme(true, ["admin", "it"], _ => false));
        Assert.Equal(Auth.Anmeldung.Anmelden, Auth.Bestimme(true, ["admin", "it"], k => k == "it"));
    }
}
