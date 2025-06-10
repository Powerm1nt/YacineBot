# NiceYomi Bot Discord
# niceyomi-bot

Un bot Discord qui utilise l'API OpenAI avec Supabase et Prisma pour la persistance des données.

## Configuration Docker

Ce projet utilise Docker pour simplifier le développement et la mise en production.

### Prérequis

- Docker
- Docker Compose

### Configuration des variables d'environnement

1. Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```

2. Modifiez le fichier `.env` avec vos propres valeurs :
   ```bash
   nano .env
   ```

Les variables d'environnement définies dans ce fichier seront automatiquement utilisées par Docker Compose.

### Développement

Pour lancer l'environnement de développement :

```bash
# Première exécution ou après modification du Dockerfile
yarn docker:dev:build

# Exécutions suivantes
yarn docker:dev
```

En mode développement :
- Tout le répertoire du projet est monté en volume, permettant de modifier n'importe quel fichier sans reconstruire l'image
- Les node_modules du conteneur sont préservés pour éviter des problèmes de compatibilité entre les systèmes
- Nodemon redémarre automatiquement l'application lors des modifications
- Toutes les modifications sont immédiatement disponibles dans le conteneur

### Production

Pour lancer l'environnement de production manuellement :

```bash
# Première exécution ou après modification du Dockerfile
yarn docker:prod:build

# Exécutions suivantes
yarn docker:prod
```

En mode production :
- Le code est copié dans l'image Docker
- L'application est exécutée avec PM2 pour une meilleure stabilité
- Prisma génère automatiquement les clients nécessaires
- Les migrations de base de données sont exécutées automatiquement au démarrage
- Le fichier `.env` est monté dans le conteneur

### Déploiement automatique

Ce projet est configuré avec GitHub Actions pour un déploiement automatique :

1. Chaque push sur la branche `main` déclenche un déploiement
2. Le workflow crée un fichier `.env` à partir des secrets GitHub
3. Docker et Docker Compose sont utilisés pour construire et exécuter l'application
4. Les migrations Prisma sont exécutées automatiquement

Vous pouvez également déclencher manuellement un déploiement depuis l'onglet Actions de GitHub.

### Variables d'environnement

Les variables suivantes peuvent être configurées dans le fichier `.env` :

- `POSTGRES_USER` : Nom d'utilisateur pour PostgreSQL (défaut : postgres)
- `POSTGRES_PASSWORD` : Mot de passe pour PostgreSQL (défaut : postgres)
- `POSTGRES_DB` : Nom de la base de données (défaut : app en production, app_dev en développement)
- `OPENAI_API_KEY` : Clé API pour OpenAI
- `DISCORD_TOKEN` : Token d'authentification Discord
- `ENABLE_AUTO_MESSAGES` : Activer/désactiver les messages automatiques
- `MIN_DELAY_MINUTES`, `MAX_DELAY_MINUTES` : Plage de délai pour les messages automatiques
- Et plus encore...

Consultez le fichier `.env.example` pour la liste complète des variables disponibles.
## Description
Un bot Discord qui utilise l'API OpenAI Responses pour maintenir des conversations contextuelles, avec une base de données Supabase pour la persistance des données.

## Fonctionnalités
- Répond quand il est mentionné avec "niceyomi", "yomi" ou @mention
- Maintient le contexte des conversations grâce à l'historique des messages
- Stocke les données utilisateur et les conversations dans Supabase
- Répond aux réponses directes à ses messages
- Supporte la réinitialisation des conversations avec "reset conversation"
- Utilise l'API OpenAI Responses pour une génération de réponses plus rapide

## Installation

```bash
# Installer les dépendances
yarn install

# Configurer le fichier .env avec les variables d'environnement nécessaires
# CLIENT_ID, TOKEN, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_KEY, BOT_NAME

# Lancer le bot
yarn start
```

## Utilisation
1. Mentionnez le bot avec "yomi", "niceyomi" ou @mention
2. Répondez à ses messages pour continuer la conversation
3. Utilisez "reset conversation" pour réinitialiser votre historique de conversation

## Remarques
Ce bot utilise l'API OpenAI Responses et conserve le contexte des conversations entre les messages. La migration depuis l'API Assistants (dépréciée) a été effectuée pour assurer la pérennité de l'application. Les données sont stockées dans une base de données Supabase pour une persistance efficace.
