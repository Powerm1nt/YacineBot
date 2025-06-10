# Scripts utilitaires

Ce dossier contient des scripts utilitaires pour la gestion de l'application.

## Sauvegarde et restauration de la base de données

### Sauvegarde de la base de données

Le script `backup-database.sh` permet de créer une sauvegarde complète de la base de données PostgreSQL.

```bash
# Exécution via yarn
yarn db:backup

# Ou directement
bash scripts/backup-database.sh
```

Le script va :
1. Extraire les informations de connexion depuis la variable DATABASE_URL dans le fichier .env
2. Créer un répertoire `backups` s'il n'existe pas
3. Générer un fichier de sauvegarde nommé `<nom_db>_backup_<date>_<heure>.sql.gz`
4. Compresser automatiquement la sauvegarde

### Restauration de la base de données

Le script `restore-database.sh` permet de restaurer une sauvegarde dans la base de données.

```bash
# Exécution via yarn
yarn db:restore ./backups/nom_du_fichier_sauvegarde.sql.gz

# Ou directement
bash scripts/restore-database.sh ./backups/nom_du_fichier_sauvegarde.sql.gz
```

Le script va :
1. Demander une confirmation avant de procéder (car l'opération remplace toutes les données existantes)
2. Décompresser automatiquement le fichier si nécessaire
3. Supprimer les connexions actives à la base de données
4. Recréer la base de données
5. Restaurer les données

## Précautions

- Assurez-vous d'avoir les droits d'administration sur la base de données
- Le fichier .env doit contenir une variable DATABASE_URL valide
- Pour les restaurations en production, il est recommandé de faire une sauvegarde avant

## Gestion des mots de passe spéciaux

Les scripts prennent en charge les mots de passe qui contiennent des caractères spéciaux encodés en URL.

Exemples d'encodage URL courants :
- Espace : `%20`
- Arobase @ : `%40`
- Deux-points : : `%3A`
- Slash / : `%2F`
- Caractères spéciaux comme `!$&'()*+,;=` sont également encodés

Si votre mot de passe contient des caractères spéciaux, votre chaîne de connexion dans le fichier .env pourrait ressembler à :

```
DATABASE_URL=postgresql://user:mot%20de%20passe%21@localhost:5432/mabase
```

Les scripts gèrent automatiquement le décodage de ces caractères spéciaux.

## Prérequis

- PostgreSQL Client (pg_dump, psql) installé sur le système
- Accès à la base de données avec les droits suffisants

## Installation des outils PostgreSQL

### macOS

Vous pouvez installer les outils PostgreSQL sur macOS de plusieurs façons :

#### Avec Homebrew (recommandé)

Pour installer PostgreSQL 17 :

```bash
# Installer Homebrew si ce n'est pas déjà fait
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer PostgreSQL 17
brew install postgresql@17

# Lier la version 17 pour qu'elle soit utilisée par défaut
brew link --force postgresql@17
```

Pour mettre à niveau une installation existante :

```bash
# Désinstaller la version actuelle
brew uninstall postgresql

# Installer PostgreSQL 17
brew install postgresql@17

# Lier la version 17
brew link --force postgresql@17
```

Vous pouvez également utiliser notre script d'installation automatique :

```bash
yarn db:install-tools
```

#### Avec Postgres.app

1. Téléchargez et installez [Postgres.app](https://postgresapp.com/)
2. Ajoutez les outils au PATH en exécutant :
   ```bash
   sudo mkdir -p /etc/paths.d && \
   echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
   ```
3. Redémarrez votre terminal

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql-client
```

### Linux (RHEL/CentOS/Fedora)

```bash
sudo dnf install postgresql
```

### Windows

1. Téléchargez l'installateur depuis [le site officiel de PostgreSQL](https://www.postgresql.org/download/windows/)
2. Pendant l'installation, sélectionnez au minimum les "Command Line Tools"
3. Assurez-vous que le répertoire bin est ajouté à votre PATH

### Vérification de l'installation

Pour vérifier que les outils sont correctement installés :

```bash
# Vérifier la version de psql
psql --version

# Vérifier la version de pg_dump
pg_dump --version
```
