# Schéma de la Base de Données NiceYomi Bot
# Schéma de la base de données

## Tables principales

### conversations

Stocke les informations sur les conversations entre utilisateurs et le bot.

| Colonne          | Type      | Description                                       |
|------------------|-----------|---------------------------------------------------|
| id               | BigInt    | Identifiant unique auto-incrémenté                |
| guild_id         | String?   | ID de la guilde Discord (null pour les DMs)       |
| channel_id       | String    | ID du canal Discord                               |
| last_response_id | String?   | ID de la dernière réponse OpenAI                  |
| relevance_score  | Float?    | Score global de pertinence de la conversation     |
| topic_summary    | String?   | Résumé des sujets de la conversation              |
| is_shared        | Boolean   | Indique si la conversation est partagée           |
| shared_with      | String[]  | Liste des IDs utilisateurs avec accès             |
| created_at       | DateTime  | Date de création                                  |
| updated_at       | DateTime  | Date de dernière mise à jour                      |

### messages

Stocke les messages individuels dans les conversations.

| Colonne          | Type      | Description                                       |
|------------------|-----------|---------------------------------------------------|
| id               | BigInt    | Identifiant unique auto-incrémenté                |
| conversation_id  | BigInt    | Référence à la conversation                       |
| user_id          | String    | ID de l'utilisateur Discord                       |
| user_name        | String    | Nom de l'utilisateur                              |
| content          | String    | Contenu du message                                |
| is_bot           | Boolean   | Indique si le message est du bot                  |
| relevance_score  | Float?    | Score de pertinence du message                    |
| has_key_info     | Boolean   | Indique si le message contient des infos clés     |
| created_at       | DateTime  | Date de création du message                       |

### guild_preferences

Stocke les préférences par serveur Discord.

| Colonne          | Type      | Description                                       |
|------------------|-----------|---------------------------------------------------|
| id               | BigInt    | Identifiant unique auto-incrémenté                |
| guild_id         | String    | ID de la guilde Discord                           |
| response_type    | String?   | Type de réponse préféré                           |
| language         | String?   | Langue préférée                                   |
| notifications    | Boolean   | Activer/désactiver les notifications              |
| custom_settings  | Json?     | Paramètres personnalisés additionnels             |
| created_at       | DateTime  | Date de création                                  |
| updated_at       | DateTime  | Date de mise à jour                               |

## Tables de tâches

### tasks

Stocke les tâches planifiées et du worker.

| Colonne          | Type      | Description                                       |
|------------------|-----------|---------------------------------------------------|
| id               | BigInt    | Identifiant unique auto-incrémenté                |
| type             | String    | Type de tâche                                     |
| status           | String    | Statut de la tâche                                |
| data             | Json      | Données de la tâche                               |
| priority         | Int       | Priorité d'exécution                              |
| created_at       | DateTime  | Date de création                                  |
| updated_at       | DateTime  | Date de mise à jour                               |
| started_at       | DateTime? | Date de début d'exécution                         |
| completed_at     | DateTime? | Date de fin d'exécution                           |
| failed_at        | DateTime? | Date d'échec                                      |
| error            | String?   | Message d'erreur                                  |
| retry_count      | Int       | Nombre de tentatives                              |
| next_retry_at    | DateTime? | Date de prochaine tentative                       |
| scheduler_id     | String?   | ID dans le scheduler                              |
| task_number      | Int?      | Numéro de la tâche planifiée                      |
| next_execution   | DateTime? | Date de prochaine exécution                       |
| target_channel_type | String? | Type de canal ciblé                              |

### task_executions

Stocke les exécutions de tâches planifiées.

| Colonne          | Type      | Description                                       |
|------------------|-----------|---------------------------------------------------|
| id               | Int       | Identifiant unique auto-incrémenté                |
| task_id          | BigInt    | Référence à la tâche                              |
| scheduler_id     | String?   | ID dans le scheduler                              |
| channel_id       | String    | ID du canal d'exécution                           |
| user_id          | String    | ID de l'utilisateur                               |
| message          | String    | Message envoyé                                    |
| executed_at      | DateTime  | Date d'exécution                                  |
| created_at       | DateTime  | Date de création                                  |

## Tables d'analyse

### usage_stats

Stocke les statistiques d'utilisation des commandes.

| Colonne          | Type      | Description                                       |
|------------------|-----------|---------------------------------------------------|
| id               | BigInt    | Identifiant unique auto-incrémenté                |
| user_id          | String    | ID de l'utilisateur                               |
| command_type     | String    | Type de commande utilisée                         |
| tokens_used      | Int       | Nombre de tokens utilisés                         |
| used_at          | DateTime  | Date d'utilisation                                |

## Migration depuis l'ancienne structure

Pour migrer depuis l'ancienne structure de données vers la nouvelle avec analyse de pertinence :

1. Appliquer la migration `20250610120000_add_conversation_analysis`
2. Exécuter le script d'analyse des conversations existantes : `yarn analyze:conversations`

Ce processus met à jour les conversations existantes avec des scores de pertinence et des résumés de sujets.
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
