# Dreistufig: Node baut die Oberfläche, das SDK den Server, das Laufzeit-Image
# trägt nur das Ergebnis (~100 MB). Die Oberfläche liegt als wwwroot im Server.
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# die Hilfe liegt neben web/ — build-help.mjs liest ../help; die Oberfläche importiert aus ../plugins (table/transform.mjs)
COPY help/ /help/
COPY plugins/ /plugins/
# nur die Oberfläche — die gebauten Plugins (plugins/<key>/entry.js) liegen im Repo
RUN npm run build:web

# Plugin derive (Vorschauen rechnen): sharp/libvips als Linux-Binärdateien — auf dem Host installierte node_modules (Windows) passen nicht
FROM node:22-bookworm-slim AS derive
WORKDIR /derive
COPY plugins/derive/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Plugin docs (Text aus Dokumenten lesen): pdfjs-dist als Linux-Installation — wie bei derive
FROM node:22-bookworm-slim AS docs
WORKDIR /docs
COPY plugins/docs/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Journali.Core/Journali.Core.csproj Journali.Core/
COPY Journali.Server/Journali.Server.csproj Journali.Server/
RUN dotnet restore Journali.Server/Journali.Server.csproj
COPY Journali.Core/ Journali.Core/
COPY Journali.Server/ Journali.Server/
COPY --from=web /Journali.Server/wwwroot Journali.Server/wwwroot
# ohne Debugsymbole: keine .pdb im Image — keine Dateipfade und Zeilennummern des Bau-Rechners
RUN dotnet publish Journali.Server/Journali.Server.csproj -c Release -o /app --no-restore -p:DebugType=none -p:DebugSymbols=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
# node für Prozess-Plugins (Jobs: backup, json, export, datasheet) — nur die Binärdatei, kein npm
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=build /app .
# Plugins liegen im Image als Grundausstattung; compose.yaml legt ./plugins darüber (Bind-Mount) —
# so lassen sie sich austauschen und aktualisieren, ohne das Image neu zu bauen
COPY plugins/ ./plugins/
COPY --from=derive /derive/node_modules ./plugins/derive/node_modules
COPY --from=docs /docs/node_modules ./plugins/docs/node_modules
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Journali.Server.dll"]
