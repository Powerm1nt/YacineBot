# YacineBot

Un bot Discord qui utilise l'API OpenAI avec Supabase et Prisma pour la persistance des données.

## Fonctionnalités
- Répond quand il est mentionné avec "niceyomi", "yomi" ou @mention
- Maintient le contexte des conversations grâce à l'historique des messages
- Répond aux réponses directes à ses messages
- Supporte la réinitialisation des conversations avec "reset conversation"
- Utilise l'API OpenAI Responses pour une génération de réponses plus rapide
- Analyse les images et documents PDF partagés dans les conversations
- Recherche et partage des GIFs via l'API Tenor


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
# Discord AI Assistant Bot

Un bot Discord intégrant une IA conversationnelle avec analyse et partage de conversations.

## Fonctionnalités

- Interactions IA via OpenAI API (GPT-4.1-mini)
- Historique des conversations avec contexte
- Analyse de pertinence des messages et conversations
- Partage de conversations entre utilisateurs
- Planification de tâches automatiques

## Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```
OPENAI_API_KEY=your_openai_api_key
CLIENT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_bot_id
BOT_NAME=Yassine
DATABASE_URL=postgresql://user:password@localhost:5432/bot_db
```

## Installation

```bash
# Installation des dépendances
yarn install

# Générer le client Prisma
yarn prisma:generate

# Appliquer les migrations de base de données
yarn prisma:migrate
```

## Lancement

```bash
# Mode développement
yarn dev

# Mode production
yarn start
```

## Commandes disponibles

- `/ai <message>` - Interagir avec l'assistant IA
- `/reset` - Réinitialiser la conversation en cours
- `/conversations share <@utilisateur>` - Partager une conversation avec un utilisateur
- `/conversations list` - Voir les conversations partagées avec vous
- `/help` - Afficher l'aide

## Scripts utiles

- `yarn analyze:conversations` - Analyser les conversations existantes pour calculer leur pertinence

## Docker

Le projet peut être déployé avec Docker :

```bash
# Construction de l'image
docker build -t discord-ai-bot --target production .

# Lancement du conteneur
docker run -d --name discord-bot --env-file .env discord-ai-bot
```

## Base de données

- Les migrations de base de données sont exécutées automatiquement au démarrage
- Le schéma Prisma définit toutes les tables et relations
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
- `TENOR_API_KEY` : Clé API pour Tenor (service de GIFs). Une clé par défaut est fournie, mais il est recommandé d'obtenir votre propre clé pour un usage en production.
- Et plus encore...

Consultez le fichier `.env.example` pour la liste complète des variables disponibles.
## Description
Un bot Discord qui utilise l'API OpenAI Responses pour maintenir des conversations contextuelles, avec une base de données Supabase pour la persistance des données.

## Installation

```bash
# Installer les dépendances
yarn install

# Configurer le fichier .env avec les variables d'environnement nécessaires
# CLIENT_ID, TOKEN, OPENAI_API_KEY, BOT_NAME

# Lancer le bot
yarn start
```

## Utilisation
1. Mentionnez le bot avec "yomi", "niceyomi" ou @mention
2. Répondez à ses messages pour continuer la conversation
3. Utilisez "reset conversation" pour réinitialiser votre historique de conversation

## Remarques
Ce bot utilise l'API OpenAI Responses et conserve le contexte des conversations entre les messages. La migration depuis l'API Assistants (dépréciée) a été effectuée pour assurer la pérennité de l'application. Les données sont stockées dans une base de données Supabase pour une persistance efficace.

## Fonctionnalité GIF (Tenor API)

Le bot intègre désormais la possibilité de rechercher et partager des GIFs via l'API Tenor de Google. Cette fonctionnalité est implémentée avec une architecture MCP (Message Consumer Processor) pour une meilleure séparation des responsabilités.

### Architecture MCP

L'implémentation utilise le pattern MCP (Message Consumer Processor) pour communiquer avec l'API Tenor :

1. Le module `tenorApiMcp.js` gère toutes les communications avec l'API Tenor
2. Les requêtes sont envoyées sous forme de messages avec un type et une charge utile (payload)
3. Le service `attachmentService.js` utilise le MCP pour effectuer les opérations liées aux GIFs

Cette architecture permet :
- Une meilleure séparation des responsabilités
- Une facilité de test et de maintenance
- Une extensibilité pour ajouter de nouvelles fonctionnalités

### Configuration de l'API Tenor

1. Par défaut, une clé API limitée est fournie pour les tests
2. Pour un usage en production, obtenez votre propre clé API Google Cloud avec l'API Tenor activée
3. Ajoutez votre clé dans le fichier `.env` : `TENOR_API_KEY=votre_clé_api`

### Utilisation des fonctions GIF

```javascript
// Méthode 1: Via le service attachmentService (recommandé)
import { attachmentService } from './services/attachmentService.js';

// Rechercher des GIFs
const gifs = await attachmentService.searchGifs('happy', 5); // Recherche 5 GIFs "happy"

// Obtenir un GIF aléatoire
const randomGif = await attachmentService.getRandomGif('cat'); // GIF aléatoire de chat

// Obtenir l'URL d'un GIF
const gifUrl = attachmentService.getGifUrl(gifObject, 'gif'); // Format complet
const mediumUrl = attachmentService.getGifUrl(gifObject, 'mediumgif'); // Format moyen
const tinyUrl = attachmentService.getGifUrl(gifObject, 'tinygif'); // Format miniature

// Préparer un GIF pour Discord
const discordGif = attachmentService.prepareGifForDiscord(gifObject);
// Utilisation dans un message Discord :
// message.channel.send({ content: 'Voici un GIF!', files: [discordGif.url] });

// Méthode 2: Utilisation directe du MCP (pour des cas avancés)
import { tenorApiMcp } from './utils/tenorApiMcp.js';

// Rechercher des GIFs
const searchMessage = {
  type: tenorApiMcp.MESSAGE_TYPES.SEARCH_GIFS,
  payload: {
    searchTerm: 'coding',
    limit: 5
  }
};
const searchResponse = await tenorApiMcp.processMessage(searchMessage);
const gifs = searchResponse.payload;

// Obtenir un GIF aléatoire
const randomMessage = {
  type: tenorApiMcp.MESSAGE_TYPES.GET_RANDOM_GIF,
  payload: {
    searchTerm: 'happy'
  }
};
const randomResponse = await tenorApiMcp.processMessage(randomMessage);
const randomGif = randomResponse.payload;
```

### Scripts de test

Deux scripts de test sont disponibles pour démontrer l'utilisation de ces fonctions :

1. `scripts/test-gif-api.js` - Teste les fonctions de base du service attachmentService
2. `scripts/test-tenor-mcp.js` - Teste l'implémentation MCP et son intégration avec attachmentService
