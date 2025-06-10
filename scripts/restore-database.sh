#!/bin/bash

# Script de restauration de la base de données PostgreSQL

# Vérification de l'argument
if [ -z "$1" ]; then
  echo "Usage: $0 <chemin_fichier_sauvegarde>"
  echo "Exemple: $0 ./backups/database_backup_20250610_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

# Vérification de l'existence du fichier de sauvegarde
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Erreur: Le fichier de sauvegarde '$BACKUP_FILE' n'existe pas"
  exit 1
fi

# Récupération des variables d'environnement
source .env

# Extraction des informations de connexion depuis DATABASE_URL
DB_URL="$DATABASE_URL"

if [ -z "$DB_URL" ]; then
  echo "Erreur: Variable DATABASE_URL non définie dans le fichier .env"
  exit 1
fi

# Extraction des composants de l'URL de connexion
# Support des deux formats: postgres:// et postgresql://
if [[ $DB_URL =~ ^(postgres|postgresql)://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
  DB_USER="${BASH_REMATCH[2]}"
  DB_PASS_ENCODED="${BASH_REMATCH[3]}"
  DB_HOST="${BASH_REMATCH[4]}"
  DB_PORT="${BASH_REMATCH[5]}"
  DB_NAME="${BASH_REMATCH[6]}"
  # Gestion des paramètres supplémentaires
  DB_NAME=$(echo "$DB_NAME" | cut -d'?' -f1)

  # Décodage URL du mot de passe
  # Fonction pour décoder les caractères URL encodés
  urldecode() {
    local url_encoded="${1//+/ }"
    printf '%b' "${url_encoded//%/\\x}"
  }

  # Appliquer le décodage URL au mot de passe
  DB_PASS=$(urldecode "$DB_PASS_ENCODED")

  echo "Connexion à la base de données $DB_NAME sur $DB_HOST:$DB_PORT avec l'utilisateur $DB_USER"
else
  echo "Erreur: Format de DATABASE_URL incorrect"
  echo "Format attendu: postgres://utilisateur:mot_de_passe@hôte:port/nom_base"
  echo "ou: postgresql://utilisateur:mot_de_passe@hôte:port/nom_base"
  exit 1
fi

# Définition de la variable d'environnement PGPASSWORD pour éviter l'invite de mot de passe
export PGPASSWORD="$DB_PASS"

echo "ATTENTION: Cette opération va remplacer toutes les données existantes dans la base $DB_NAME"
echo "Êtes-vous sûr de vouloir continuer? (y/n)"
read -r confirm

if [[ $confirm != "y" && $confirm != "Y" ]]; then
  echo "Restauration annulée"
  exit 0
fi

echo "Restauration de la base de données $DB_NAME depuis $BACKUP_FILE..."

# Création d'un fichier temporaire si nécessaire
TEMP_FILE=""

# Vérification si le fichier est compressé (.gz)
if [[ "$BACKUP_FILE" == *.gz ]]; then
  TEMP_FILE="/tmp/$(basename "$BACKUP_FILE" .gz)"
  echo "Décompression du fichier de sauvegarde..."
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  RESTORE_FILE="$TEMP_FILE"
else
  RESTORE_FILE="$BACKUP_FILE"
fi

# Vérification de la disponibilité des outils PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "Erreur: psql n'est pas disponible."
  echo ""
  echo "Installation des outils PostgreSQL:"
  echo ""
  echo "  Sur macOS avec Homebrew:"
  echo "    brew install postgresql@17"
  echo "    brew link --force postgresql@17"
  echo ""
  echo "  Sur macOS avec Postgres.app:"
  echo "    1. Installer Postgres.app depuis https://postgresapp.com"
  echo "    2. sudo mkdir -p /etc/paths.d && echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp"
  echo "    3. Redémarrer le terminal"
  echo ""
  echo "  Sur Linux (Ubuntu/Debian):"
  echo "    sudo apt update && sudo apt install postgresql-client"
  echo ""
  echo "  Pour plus d'instructions, voir scripts/README.md"
  echo "  Ou utilisez notre script d'installation: yarn db:install-tools"
  echo ""
  exit 1
fi

# Vérification de la version de psql
check_pg_version() {
  # Obtenir la version du serveur
  export PGPASSWORD="$DB_PASS"
  SERVER_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "postgres" -t -c "SHOW server_version;" 2>/dev/null | xargs)
  unset PGPASSWORD

  if [ -z "$SERVER_VERSION" ]; then
    echo "Impossible d'obtenir la version du serveur PostgreSQL. Continuons quand même..."
    return 0
  fi

  # Obtenir la version majeure du serveur
  SERVER_MAJOR_VERSION=$(echo "$SERVER_VERSION" | grep -oE '^[0-9]+')

  # Obtenir la version de psql
  PSQL_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  PSQL_MAJOR_VERSION=$(echo "$PSQL_VERSION" | grep -oE '^[0-9]+')

  echo "Version du serveur PostgreSQL: $SERVER_VERSION (majeure: $SERVER_MAJOR_VERSION)"
  echo "Version locale de psql: $PSQL_VERSION (majeure: $PSQL_MAJOR_VERSION)"

  # Vérifier si le fichier est une sauvegarde de version supérieure
  # Pour cette vérification, on pourrait examiner l'en-tête du fichier de sauvegarde
  # mais cela peut être complexe, surtout si le fichier est compressé

  # Vérifier la compatibilité générale
  if [ "$PSQL_MAJOR_VERSION" -lt "$SERVER_MAJOR_VERSION" ]; then
    echo "ATTENTION: La version de psql ($PSQL_MAJOR_VERSION) est inférieure à celle du serveur ($SERVER_MAJOR_VERSION)."
    echo "Cela peut causer des erreurs. Voulez-vous mettre à jour psql? (y/n)"
    read -r update_choice

    if [[ $update_choice == "y" || $update_choice == "Y" ]]; then
      echo "Exécution du script d'installation pour mettre à jour psql..."
      bash "$(dirname "$0")/install-postgres-tools.sh"

      # Vérifier si la mise à jour a réussi
      NEW_PSQL_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
      NEW_PSQL_MAJOR_VERSION=$(echo "$NEW_PSQL_VERSION" | grep -oE '^[0-9]+')

      if [ "$NEW_PSQL_MAJOR_VERSION" -lt "$SERVER_MAJOR_VERSION" ]; then
        echo "La mise à jour n'a pas résolu le problème de version. Consultez le README pour des instructions manuelles."
        echo "Continuons quand même, mais des erreurs peuvent survenir..."
      else
        echo "Mise à jour réussie. Nouvelle version de psql: $NEW_PSQL_VERSION"
      fi
    else
      echo "Continuation sans mise à jour. Des erreurs peuvent survenir..."
    fi
  fi
}

# Exécuter la vérification de version
check_pg_version

# Fonction pour exécuter une commande psql avec gestion d'erreurs
run_psql_command() {
  local db=$1
  local command=$2
  local description=$3
  local attempt=1
  local max_attempts=3

  while [ $attempt -le $max_attempts ]; do
    echo "$description (tentative $attempt/$max_attempts)..."

    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -c "$command" 2>/dev/null; then
      return 0
    else
      if [ $attempt -lt $max_attempts ]; then
        echo "Échec. Nouvelle tentative dans 3 secondes..."
        sleep 3
        attempt=$((attempt+1))
      else
        echo "Échec après $max_attempts tentatives."
        return 1
      fi
    fi
  done
}

# Suppression des connexions existantes à la base de données
echo "Fermeture des connexions actives à la base de données..."
run_psql_command "postgres" "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" "Fermeture des connexions actives"

# Attente pour s'assurer que toutes les connexions sont fermées
sleep 2

# Recréation de la base de données
echo "Recréation de la base de données..."
run_psql_command "postgres" "DROP DATABASE IF EXISTS $DB_NAME;" "Suppression de la base de données existante"
if [ $? -ne 0 ]; then
  echo "Erreur critique: impossible de supprimer la base de données existante"
  exit 1
fi

run_psql_command "postgres" "CREATE DATABASE $DB_NAME;" "Création d'une nouvelle base de données vide"
if [ $? -ne 0 ]; then
  echo "Erreur critique: impossible de créer une nouvelle base de données"
  exit 1
fi

# Restauration des données
echo "Restauration des données depuis $RESTORE_FILE..."
echo "Cette opération peut prendre plusieurs minutes selon la taille de la sauvegarde..."

# Utiliser psql avec un timeout plus long pour les grandes sauvegardes
PGCONNECT_TIMEOUT=60 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$RESTORE_FILE"

# Vérification du succès de la restauration
if [ $? -eq 0 ]; then
  echo "Restauration réussie de la base de données $DB_NAME"

  # Nettoyage du fichier temporaire si nécessaire
  if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
    rm "$TEMP_FILE"
    echo "Fichier temporaire supprimé"
  fi

  echo "\nPour appliquer les migrations les plus récentes, exécutez:"
  echo "yarn prisma:migrate"
else
  echo "Erreur lors de la restauration de la base de données"
  exit 1
fi

# Nettoyage
unset PGPASSWORD
