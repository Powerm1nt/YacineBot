# Système d'analyse et de réponse différée

## Présentation

Le bot a été amélioré avec un système d'analyse de pertinence des messages qui lui permet de décider s'il doit répondre immédiatement, plus tard, ou pas du tout à un message.

## Fonctionnement

1. **Réponse immédiate** : Le bot répond immédiatement dans les cas suivants :
   - Lorsqu'il est directement mentionné (`@Bot`)
   - Lorsqu'on lui envoie un message privé (DM)
   - Lorsqu'on répond à un de ses messages
   - Lorsque le message contient une question (avec '?')
   - Lorsque le message contient des mots urgents (`aide`, `help`, etc.)

2. **Analyse de pertinence** : Si le message ne répond pas aux critères de réponse immédiate, le bot analyse sa pertinence et décide s'il faut y répondre.

3. **Réponse différée** : Pour les messages qui ne nécessitent pas de réponse immédiate mais qui pourraient être pertinents, le bot peut décider d'y répondre plus tard après une analyse plus approfondie.

## Configuration

Le système d'analyse et de réponse différée peut être activé ou désactivé via la variable d'environnement `ENABLE_SCHEDULER` :

```env
ENABLE_SCHEDULER=true  # Activer le système
ENABLE_SCHEDULER=false # Désactiver le système
```

## Services impliqués

1. **messageEvaluator** : Utilitaire qui évalue si un message mérite une réponse immédiate ou différée.

2. **messageMonitoringService** : Service qui surveille les messages pour décider d'y répondre plus tard.

3. **analysisService** : Service qui analyse la pertinence des messages et des conversations.

## Avantages

- **Moins de spam** : Le bot ne répond pas à tous les messages, seulement aux plus pertinents.
- **Comportement plus humain** : Le bot peut décider de répondre plus tard à un message, comme le ferait un humain.
- **Meilleure qualité de conversation** : Les conversations sont plus pertinentes et utiles.

## Exemples

### Réponse immédiate

```
Utilisateur: @Bot, peux-tu m'aider avec mon code ?
Bot: [répond immédiatement]
```

### Réponse différée

```
Utilisateur: Je me demande quelle technologie utiliser pour mon projet.
[le bot analyse le message et décide d'y répondre quelques minutes plus tard]
Bot: Pour ton projet, ça dépend vraiment de ce que tu veux faire, mais je te conseille...
```

### Pas de réponse

```
Utilisateur: ok cool
[le bot analyse le message et décide qu'il n'est pas pertinent d'y répondre]
```
