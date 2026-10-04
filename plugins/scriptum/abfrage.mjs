// Wie oft die Ansicht nach einem laufenden Skript fragt (04.10.2026): erst oft, dann seltener — ein Lauf über Stunden fragte sonst alle 0,7 s
// nach, mit dem Log in jeder Antwort. seit: Start des Laufs (ms), jetzt: die Uhr.
export const abstand = (seit, jetzt = Date.now()) => { const t = jetzt - (seit ?? jetzt); return t < 15000 ? 700 : t < 60000 ? 2000 : 5000 }
