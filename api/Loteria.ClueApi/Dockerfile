FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY api/Loteria.ClueApi/Loteria.ClueApi.csproj api/Loteria.ClueApi/
RUN dotnet restore api/Loteria.ClueApi/Loteria.ClueApi.csproj

COPY api/Loteria.ClueApi/ api/Loteria.ClueApi/
COPY Cards/card-metadata.json Cards/card-metadata.json
RUN dotnet publish api/Loteria.ClueApi/Loteria.ClueApi.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
ENV ClueModel__Provider=Fake
EXPOSE 8080
USER $APP_UID

ENTRYPOINT ["dotnet", "Loteria.ClueApi.dll"]
