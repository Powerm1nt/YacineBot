# Système de Gestion de Contexte

## Architecture

Le système de gestion de contexte est maintenant structuré pour isoler les différents types de conversations :

- **guildConversations** : Stocke le contexte des conversations dans les serveurs Discord
- **dmConversations** : Stocke uniquement les conversations privées (DM)
- **groupConversations** : Stocke les conversations de groupe

## Fonctionnement

Chaque type de conversation utilise un stockage séparé pour éviter que les contextes ne se mélangent. Lorsqu'un message est traité :

1. Son type est identifié (serveur, DM, groupe)
2. La clé de contexte appropriée est générée
3. Le contexte est récupéré depuis le stockage correspondant au type
4. Les réponses sont stockées dans le même stockage spécifique

## Avantages

- Isolation complète des messages privés
- Meilleure organisation des données de contexte
- Séparation claire entre les différents environnements de conversation
- Performance améliorée grâce à des stockages plus petits

Cette architecture permet une meilleure gestion de la mémoire et une isolation efficace des contextes, évitant ainsi le mélange accidentel de conversations privées avec d'autres types de discussions.
