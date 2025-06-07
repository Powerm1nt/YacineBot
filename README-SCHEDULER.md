# Planificateur de Messages Automatiques

## Description
Ce module utilise `toad-scheduler` pour envoyer des messages automatiques aux utilisateurs afin d'animer les conversations sur vos serveurs Discord. Les messages sont envoyés de manière aléatoire entre 10 minutes et 2 heures pour éviter le spam tout en maintenant une activité régulière.

## Fonctionnalités
- Envoi de messages aléatoires avec des questions générées par OpenAI
- Création d'un nombre configurable de tâches simultanées (1-3 par défaut)
- Sélection aléatoire d'un canal et d'un utilisateur pour chaque message
- Support de différents types de canaux (serveurs, messages privés, groupes)
- Délai aléatoire configurable entre les messages (10-120 minutes par défaut)
- Envoi de messages uniquement pendant les heures actives (8h-23h)
- Affichage de l'état des tâches et des prochaines exécutions
- Commandes pour démarrer/arrêter/surveiller le planificateur

## Configuration

1. Assurez-vous que ces variables sont définies dans votre fichier `.env` :

```
# Activer les messages automatiques
ENABLE_AUTO_MESSAGES=true

# Fuseau horaire pour les logs (informatif uniquement)
TIMEZONE=Europe/Paris

# Configuration des tâches planifiées
# Délai minimum entre les messages (en minutes)
MIN_DELAY_MINUTES=10
# Délai maximum entre les messages (en minutes)
MAX_DELAY_MINUTES=120
# Nombre minimum de tâches simultanées
MIN_TASKS=1
# Nombre maximum de tâches simultanées
MAX_TASKS=3

# Type de canal ciblé par défaut (guild, dm, group ou laisser vide pour aléatoire)
TARGET_CHANNEL_TYPE=
```

2. Le planificateur démarre automatiquement avec le bot

## Commandes

- `f!scheduler start` - Démarre le planificateur de tâches avec un nombre aléatoire de tâches
- `f!scheduler stop` - Arrête le planificateur de tâches
- `f!scheduler restart` - Redémarre le planificateur avec de nouvelles tâches aléatoires
- `f!scheduler status` - Affiche l'état détaillé des tâches planifiées avec prochaines exécutions
- `f!scheduler stats` - Affiche des statistiques sur les tâches planifiées (délais min/max/moyen)
- `f!scheduler debug [n°tâche]` - Affiche des informations détaillées pour déboguer les tâches
- `f!scheduler force <n°tâche>` - Force l'exécution immédiate d'une tâche spécifique (à venir)
- `f!scheduler channel <type> [n°tâche]` - Configure le type de canal ciblé (global ou pour une tâche spécifique)
- `f!scheduler targets` - Affiche des statistiques détaillées sur les canaux et utilisateurs ciblés
  - `guild` - Uniquement les salons de serveur
  - `dm` - Uniquement les messages privés
  - `group` - Uniquement les groupes privés
  - `random` - Sélection aléatoire (par défaut)
- `f!scheduler config <paramètre> <valeur>` - Configure les paramètres du planificateur
  - `min_delay` - Délai minimum en minutes
  - `max_delay` - Délai maximum en minutes
  - `min_tasks` - Nombre minimum de tâches simultanées
  - `max_tasks` - Nombre maximum de tâches simultanées

## Types de canaux supportés

Le planificateur peut envoyer des messages dans trois types de canaux :

1. **Serveurs** (`guild`) - Canaux textuels sur les serveurs Discord
   - Sélectionne un serveur aléatoire
   - Puis un canal textuel aléatoire dans ce serveur
   - Enfin un membre aléatoire à mentionner

2. **Messages Privés** (`dm`) - Conversations privées avec des utilisateurs
   - Sélectionne un canal de message privé aléatoire parmi les conversations existantes
   - Envoie un message à cet utilisateur

3. **Groupes** (`group`) - Conversations de groupe privées
   - Sélectionne un groupe aléatoire parmi les groupes disponibles
   - Mentionne un membre aléatoire du groupe

Par défaut, la distribution est :
- 70% des messages dans les serveurs
- 20% dans les messages privés
- 10% dans les groupes

Vous pouvez modifier ce comportement avec la commande `f!scheduler channel <type>` pour cibler un seul type de canal.

## Personnalisation

Vous pouvez personnaliser le comportement du planificateur en modifiant les fichiers suivants :

- `src/services/schedulerService.js` - Logique principale du planificateur
- `src/services/messageGenerator.js` - Génération des questions

Le planificateur utilise les fonctionnalités natives de date-fns pour la gestion des heures, ce qui assure un respect des heures locales du système où le bot est exécuté.

Variables configurables dans le fichier `.env` :

- Délais entre les messages :
```
MIN_DELAY_MINUTES=10
MAX_DELAY_MINUTES=120
```

- Nombre de tâches simultanées :
```
MIN_TASKS=1
MAX_TASKS=3
```

- Heures actives pendant lesquelles les messages peuvent être envoyés (dans le code) :
```javascript
function isActiveHour(startHour = 8, endHour = 23) {
  // Modifier ces valeurs pour changer les heures actives
}
```

- Catégories de questions dans `messageGenerator.js`

## Dépannage

Si les messages automatiques ne sont pas envoyés :

1. Vérifiez que `ENABLE_AUTO_MESSAGES=true` est configuré dans votre fichier `.env`
2. Vérifiez les journaux de la console pour des erreurs
3. Assurez-vous que le bot a les permissions pour envoyer des messages dans les canaux
4. Utilisez `f!scheduler start` pour redémarrer manuellement le planificateur

## Exemples de configuration

```
# Configurer un délai minimum de 5 minutes entre les messages
f!scheduler config min_delay 5

# Configurer un délai maximum de 30 minutes entre les messages
f!scheduler config max_delay 30

# Augmenter le nombre maximum de tâches à 5
f!scheduler config max_tasks 5

# Définir un minimum de 2 tâches
f!scheduler config min_tasks 2

# Cibler uniquement les messages privés
f!scheduler channel dm

# Revenir à une sélection aléatoire de canaux
f!scheduler channel random
```

Nota: Ces configurations sont temporaires et ne persistent qu'en mémoire. Pour les rendre permanentes, modifiez le fichier `.env`.
