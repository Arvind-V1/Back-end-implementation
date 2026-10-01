# Internal Tools API

## Technologies
- Langage: TypeScript (Node.js 20+)
- Framework: NestJS
- Base de données: MySQL/PostgreSQL (selon choix)
- Port API: 3000 (configurable)

## Quick Start

1. `docker-compose --profile mysql up -d` # ou postgres

2. cp .env.example .env
   npm install
3. npm run start:dev
4. API disponible sur http://localhost:3000
5. Documentation: http://localhost:3000/api/docs

## Configuration
- Variables d'environnement: voir .env.example
- Configuration DB: renseigner DB_HOST, DB_PORT, DB_USER, DB_PASSWORD et DB_NAME dans .env. Les valeurs par défaut correspondent au conteneur MySQL lancé par docker-compose.

## Tests  
[commande_lancement_tests] - Tests unitaires + intégration

## Architecture
- [Justification_choix_tech]
- [Structure_projet_expliquee]