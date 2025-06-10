#!/bin/bash

# Script de sauvegarde de la base de données PostgreSQL

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

# Création du répertoire de sauvegarde s'il n'existe pas
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Nom du fichier de sauvegarde avec la date
DATETIME=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_$DATETIME.sql"

# Définition de la variable d'environnement PGPASSWORD pour éviter l'invite de mot de passe
export PGPASSWORD="$DB_PASS"

echo "Sauvegarde de la base de données $DB_NAME vers $BACKUP_FILE..."

# Vérification de la disponibilité de pg_dump
if ! command -v pg_dump &> /dev/null; then
  echo "Erreur: pg_dump n'est pas disponible."
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

# Vérification de la version de pg_dump
check_pg_version() {
  # Obtenir la version du serveur
  export PGPASSWORD="$DB_PASS"
  SERVER_VERSION=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW server_version;" 2>/dev/null | xargs)
  unset PGPASSWORD

  if [ -z "$SERVER_VERSION" ]; then
    echo "Impossible d'obtenir la version du serveur PostgreSQL. Continuons quand même..."
    return 0
  fi

  # Obtenir la version majeure du serveur
  SERVER_MAJOR_VERSION=$(echo "$SERVER_VERSION" | grep -oE '^[0-9]+')

  # Obtenir la version de pg_dump
  PGDUMP_VERSION=$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  PGDUMP_MAJOR_VERSION=$(echo "$PGDUMP_VERSION" | grep -oE '^[0-9]+')

  echo "Version du serveur PostgreSQL: $SERVER_VERSION (majeure: $SERVER_MAJOR_VERSION)"
  echo "Version locale de pg_dump: $PGDUMP_VERSION (majeure: $PGDUMP_MAJOR_VERSION)"

  # Vérifier la compatibilité
  if [ "$PGDUMP_MAJOR_VERSION" -lt "$SERVER_MAJOR_VERSION" ]; then
    echo "ATTENTION: La version de pg_dump ($PGDUMP_MAJOR_VERSION) est inférieure à celle du serveur ($SERVER_MAJOR_VERSION)."
    echo "Cela peut causer des erreurs. Voulez-vous mettre à jour pg_dump? (y/n)"
    read -r update_choice

    if [[ $update_choice == "y" || $update_choice == "Y" ]]; then
      echo "Exécution du script d'installation pour mettre à jour pg_dump..."
      bash "$(dirname "$0")/install-postgres-tools.sh"

      # Vérifier si la mise à jour a réussi
      NEW_PGDUMP_VERSION=$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
      NEW_PGDUMP_MAJOR_VERSION=$(echo "$NEW_PGDUMP_VERSION" | grep -oE '^[0-9]+')

      if [ "$NEW_PGDUMP_MAJOR_VERSION" -lt "$SERVER_MAJOR_VERSION" ]; then
        echo "La mise à jour n'a pas résolu le problème de version. Consultez le README pour des instructions manuelles."
        echo "Continuons quand même, mais des erreurs peuvent survenir..."
      else
        echo "Mise à jour réussie. Nouvelle version de pg_dump: $NEW_PGDUMP_VERSION"
      fi
    else
      echo "Continuation sans mise à jour. Des erreurs peuvent survenir..."
    fi
  fi
}

# Exécuter la vérification de version
check_pg_version

# Fonction pour tenter la sauvegarde avec retries
backup_attempt() {
  local attempt=$1
  local max_attempts=$2

  echo "Tentative de sauvegarde $attempt/$max_attempts..."

  # Options de pg_dump pour une sauvegarde plus robuste
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -F p -f "$BACKUP_FILE" --no-owner --no-acl --clean --if-exists

  return $?
}

# Tentatives de sauvegarde avec retries
MAX_ATTEMPTS=3
for ((i=1; i<=MAX_ATTEMPTS; i++)); do
  backup_attempt $i $MAX_ATTEMPTS
  RESULT=$?

  if [ $RESULT -eq 0 ]; then
    echo "Sauvegarde réussie dans $BACKUP_FILE"
    break
  else
    if [ $i -lt $MAX_ATTEMPTS ]; then
      echo "Erreur lors de la tentative $i. Nouvelle tentative dans 5 secondes..."
      sleep 5
    else
      echo "Erreur lors de la sauvegarde de la base de données après $MAX_ATTEMPTS tentatives"
      exit 1
    fi
  fi
done

# Compression de la sauvegarde
echo "Compression de la sauvegarde..."
gzip -f "$BACKUP_FILE"
if [ $? -eq 0 ]; then
  echo "Sauvegarde compressée: ${BACKUP_FILE}.gz"

  # Vérification de la taille du fichier
  BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
  echo "Taille de la sauvegarde: $BACKUP_SIZE"

  # Liste des sauvegardes existantes
  echo "\nListe des sauvegardes disponibles:"
  ls -lh "$BACKUP_DIR" | grep ".gz$" | sort -r

  echo "\nPour restaurer cette sauvegarde, utilisez: yarn db:restore ${BACKUP_FILE}.gz"
else
  echo "Erreur lors de la compression de la sauvegarde"
  exit 1
fi

# Nettoyage
unset PGPASSWORD
