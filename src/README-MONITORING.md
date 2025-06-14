# Système d'analyse et de réponse différée

## Présentation

Le bot a été amélioré avec un système d'analyse de pertinence des messages qui lui permet de décider s'il doit répondre immédiatement, plus tard, ou pas du tout à un message. La fonctionnalité de questions aléatoires a été supprimée pour se concentrer sur l'analyse de pertinence et les réponses à des messages existants.

## Règles d'intervention

Le bot répond dans les cas suivants :
- Messages avec mention directe (@Yassine)
- Messages privés (DM)
- Réponses à ses propres messages
- Questions (messages contenant un point d'interrogation)
- Messages urgents ou demandes d'aide
- **Nouveauté** : Messages qui parlent de lui (contenant les mots "Yassine", "Yassine", "le bot", etc.), même dans des conversations entre utilisateurs

Dans les conversations entre utilisateurs, le bot reste généralement en retrait, sauf si on parle explicitement de lui ou si une aide est clairement demandée.
