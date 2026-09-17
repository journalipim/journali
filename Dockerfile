# Dreistufig: Node baut die Oberfläche, das SDK den Server, das Laufzeit-Image
# trägt nur das Ergebnis (~100 MB). Die Oberfläche liegt als wwwroot im Server.
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Journali.Core/Journali.Core.csproj Journali.Core/
COPY Journali.Server/Journali.Server.csproj Journali.Server/
RUN dotnet restore Journali.Server/Journali.Server.csproj
COPY Journali.Core/ Journali.Core/
COPY Journali.Server/ Journali.Server/
COPY --from=web /Journali.Server/wwwroot Journali.Server/wwwroot
RUN dotnet publish Journali.Server/Journali.Server.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
COPY plugins/ ./plugins/
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Journali.Server.dll"]
