# Schéma de la Base de Données NiceYomi Bot

Ce document décrit le schéma de la base de données PostgreSQL utilisée par le bot NiceYomi via Prisma et Supabase.

## Tables Principales

### Conversations

Stocke les conversations par canal/serveur.

```
conversations
├── id (BigInt, Primary Key)
├── guild_id (String, Nullable) - ID du serveur Discord (null pour les DMs)
├── channel_id (String) - ID du canal Discord
├── created_at (DateTime) - Date de création
└── updated_at (DateTime) - Date de dernière mise à jour
```

Contrainte unique: `(channel_id, guild_id)`

### Messages

Stocke les messages individuels liés aux conversations.

```
messages
├── id (BigInt, Primary Key)
├── conversation_id (BigInt) - Relation avec conversations.id
├── user_id (String) - ID Discord de l'utilisateur
├── user_name (String) - Nom de l'utilisateur
├── content (String) - Contenu du message
├── is_bot (Boolean) - Si le message est du bot (true) ou de l'utilisateur (false)
└── created_at (DateTime) - Date d'envoi du message
```

### GuildPreferences

Stocke les préférences par serveur Discord.

```
guild_preferences
├── id (BigInt, Primary Key)
├── guild_id (String, Unique) - ID du serveur Discord
├── response_type (String, Nullable) - Type de réponse préféré
├── language (String, Default: 'fr') - Langue préférée
├── notifications (Boolean, Default: true) - Activation des notifications
├── custom_settings (JSON, Nullable) - Paramètres personnalisés
├── created_at (DateTime) - Date de création
└── updated_at (DateTime) - Date de dernière mise à jour
```

### UsageStats

Stocke les statistiques d'utilisation.

```
usage_stats
├── id (BigInt, Primary Key)
├── user_id (String) - ID Discord de l'utilisateur
├── guild_id (String, Nullable) - ID du serveur Discord
├── command_type (String) - Type de commande utilisée
├── tokens_used (Integer, Default: 0) - Nombre de tokens utilisés
└── used_at (DateTime) - Date d'utilisation
```

### Tasks

Stocke les tâches planifiées ou en file d'attente.

```
tasks
├── id (BigInt, Primary Key)
├── type (String) - Type de tâche
├── status (String, Default: 'pending') - Statut de la tâche
├── data (JSON) - Données associées à la tâche
├── priority (Integer, Default: 0) - Priorité de la tâche
├── created_at (DateTime) - Date de création
├── updated_at (DateTime) - Date de dernière mise à jour
├── started_at (DateTime, Nullable) - Date de début d'exécution
├── completed_at (DateTime, Nullable) - Date de fin d'exécution
├── failed_at (DateTime, Nullable) - Date d'échec
├── error (String, Nullable) - Message d'erreur
├── retry_count (Integer, Default: 0) - Nombre de tentatives
└── next_retry_at (DateTime, Nullable) - Date de la prochaine tentative
```

### HealthCheck

Utilisée pour vérifier l'état de la connexion à la base de données.

```
health_check
├── id (Integer, Primary Key, Default: 1)
├── status (String, Default: 'ok')
└── checked_at (DateTime) - Date de dernière vérification
```

## Architecture MVC

Le projet suit une architecture Modèle-Vue-Contrôleur (MVC) :

- **Modèles** (`src/models/`) : Interaction directe avec la base de données via Prisma
- **Services** (`src/services/`) : Logique métier et traitement des données
- **Contrôleurs** (`src/controllers/`) : Coordination entre les commandes du bot et les services

## Migration depuis l'ancienne structure

Un script de migration (`prisma/migrations/migration_script.sql`) est fourni pour convertir l'ancienne structure de données (avec des tableaux JSON pour les messages) vers la nouvelle structure relationnelle plus robuste.

Le service `supabaseService.js` maintient la compatibilité avec l'ancien code pendant la transition.
