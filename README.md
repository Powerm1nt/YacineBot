# Autism
# NiceYomi Bot Discord

## Description
Un bot Discord qui utilise l'API OpenAI Responses pour maintenir des conversations contextuelles.

## Fonctionnalités
- Répond quand il est mentionné avec "niceyomi", "yomi" ou @mention
- Maintient le contexte des conversations grâce à l'historique des messages
- Répond aux réponses directes à ses messages
- Supporte la réinitialisation des conversations avec "reset conversation"
- Utilise l'API OpenAI Responses pour une génération de réponses plus rapide

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
Ce bot utilise l'API OpenAI Responses et conserve le contexte des conversations entre les messages. La migration depuis l'API Assistants (dépréciée) a été effectuée pour assurer la pérennité de l'application.