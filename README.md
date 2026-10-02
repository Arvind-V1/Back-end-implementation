# Internal Tools API

## Technologies
- Langage: TypeScript (Node.js 20+)
- Framework: NestJS
- ORM : TypeORM
- Base de données: MySQL 8 (via Docker)
- Port API: 3000 (configurable via PORT dans .env)

## Quick Start

1. `docker-compose --profile mysql up -d` 

2. cp .env.example .env
   npm install
3. npm run start:dev
   Charger les données de test (20 outils, 10 catégories, ~3 mois de sessions d'usage) :
   # Bash
   docker compose --profile mysql exec -T mysql mysql -uroot -p"$DB_PASSWORD" "$DB_NAME" < seed.sql

   # PowerShell
   Get-Content seed.sql -Raw | docker compose --profile mysql exec -T mysql mysql -uroot -pVOTRE_MOT_DE_PASSE internal_tools
4. API disponible sur http://localhost:3000
5. Documentation: http://localhost:3000/api/docs

## Configuration
- Variables d'environnement: voir .env.example
- Configuration DB: renseigner DB_HOST, DB_PORT, DB_USER, DB_PASSWORD et DB_NAME dans .env. Les valeurs par défaut correspondent au conteneur MySQL lancé par docker-compose.

## Tests  
   bash
   npm run test       # tests unitaires
   npm run test:e2e   # tests d'intégration
   npm run test:cov   # couverture

## Architecture
- [Justification_choix_tech]
- [Structure_projet_expliquee]

  src/
  ├── main.ts                         # préfixe /api, validation, filtre d'erreurs, Swagger
  ├── app.module.ts                   # configuration et connexion DB
  ├── common/
  │   └── all-exceptions.filter.ts    # format uniforme des erreurs
  └── tools/
      ├── tools.module.ts
      ├── tools.controller.ts         # routes REST
      ├── tools.service.ts            # logique métier et requêtes
      ├── dto/                        # create, update, query (validation)
      └── entities/                   # tool, category, usage-log
  seed.sql                            # données de test
  docker-compose.yml                  # MySQL (profil mysql)