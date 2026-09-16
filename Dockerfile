# Mehrstufig: SDK baut, Laufzeit-Image trägt nur das Ergebnis (~100 MB).
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Journali.Core/Journali.Core.csproj Journali.Core/
COPY Journali.Server/Journali.Server.csproj Journali.Server/
RUN dotnet restore Journali.Server/Journali.Server.csproj
COPY Journali.Core/ Journali.Core/
COPY Journali.Server/ Journali.Server/
RUN dotnet publish Journali.Server/Journali.Server.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Journali.Server.dll"]
