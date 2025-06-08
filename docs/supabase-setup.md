# Configuration de Supabase pour NiceYomi Bot

Ce document explique comment configurer Supabase pour stocker les données du bot NiceYomi.

## Création d'un projet Supabase

1. Créez un compte sur [Supabase](https://supabase.com/) si vous n'en avez pas déjà un
2. Créez un nouveau projet dans l'interface Supabase
3. Notez l'URL de votre projet et la clé anon/public (disponibles dans les paramètres du projet, section API)

## Configuration de la base de données

1. Accédez à l'éditeur SQL de votre projet Supabase
2. Copiez et exécutez le contenu du fichier `supabase/schema.sql` fourni dans ce dépôt

Ce script créera les tables suivantes:
- `conversations`: stocke l'historique des conversations des utilisateurs
- `user_preferences`: stocke les préférences utilisateur
- `usage_stats`: enregistre les statistiques d'utilisation
- `health_check`: table utilisée pour vérifier la santé de la connexion

## Configuration des variables d'environnement

Ajoutez les variables suivantes à votre fichier `.env`:

```
SUPABASE_URL=https://votre-id-projet.supabase.co
SUPABASE_KEY=votre-clé-anon-public
```

## Vérification de la connexion

Lorsque le bot démarre, il tente automatiquement de se connecter à Supabase et vérifie la connexion. Vous pouvez vérifier les logs pour confirmer que la connexion est établie.

## Structure des tables

### conversations
- `id`: identifiant unique
- `user_id`: ID Discord de l'utilisateur
- `messages`: tableau JSON contenant l'historique des messages
- `created_at`: date de création
- `updated_at`: date de dernière mise à jour

### user_preferences
- `id`: identifiant unique
- `user_id`: ID Discord de l'utilisateur
- `response_type`: type de réponse préféré
- `language`: langue préférée
- `notifications`: activation/désactivation des notifications
- `custom_settings`: paramètres personnalisés (JSON)
- `created_at`: date de création
- `updated_at`: date de dernière mise à jour

### usage_stats
- `id`: identifiant unique
- `user_id`: ID Discord de l'utilisateur
- `command_type`: type de commande utilisée
- `tokens_used`: nombre de tokens utilisés
- `used_at`: date d'utilisation

## Utilisation avec le bot

Le service Supabase est utilisé automatiquement par le bot pour:
1. Stocker et récupérer l'historique des conversations
2. Enregistrer les préférences des utilisateurs
3. Suivre les statistiques d'utilisation

Toutes les interactions avec Supabase sont gérées par le fichier `src/services/supabaseService.js`.