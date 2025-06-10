#!/bin/bash

# Script pour installer les outils PostgreSQL sur différentes plateformes

# Fonction pour détecter le système d'exploitation
detect_os() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macos"
  elif [[ -f /etc/os-release ]]; then
    source /etc/os-release
    if [[ "$ID" == "ubuntu" || "$ID" == "debian" || "$ID_LIKE" == *"ubuntu"* || "$ID_LIKE" == *"debian"* ]]; then
      echo "debian"
    elif [[ "$ID" == "fedora" || "$ID" == "rhel" || "$ID" == "centos" || "$ID_LIKE" == *"fedora"* ]]; then
      echo "fedora"
    else
      echo "unknown"
    fi
  else
    echo "unknown"
  fi
}

# Fonction pour vérifier si une commande existe
check_command() {
  command -v "$1" &> /dev/null
}

# Fonction pour installer sur macOS
install_macos() {
  echo "Détection de l'installation sur macOS..."

  # Vérifier si Homebrew est installé
  if ! check_command brew; then
    echo "Homebrew n'est pas installé. Installation de Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [ $? -ne 0 ]; then
      echo "Échec de l'installation de Homebrew. Veuillez l'installer manuellement."
      echo "Voir: https://brew.sh/"
      return 1
    fi
  fi

  # Vérifier les versions installées
  if check_command psql; then
    CURRENT_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
    echo "Version actuelle de PostgreSQL: $CURRENT_VERSION"

    # Si la version est inférieure à 17, mettre à jour
    if [[ $(echo "$CURRENT_VERSION < 17" | bc) -eq 1 ]]; then
      echo "Mise à niveau de PostgreSQL vers la version 17..."
      brew uninstall postgresql || true
      echo "Installation de PostgreSQL 17 via Homebrew..."
      brew install postgresql@17

      # Lier la version 17 pour qu'elle soit disponible dans le PATH
      brew link --force postgresql@17

      if [ $? -ne 0 ]; then
        echo "Échec de l'installation de PostgreSQL 17 via Homebrew."
        echo "Essai d'installation de la version standard..."
        brew install postgresql
      fi
    fi
  else
    echo "Installation de PostgreSQL 17 via Homebrew..."
    brew install postgresql@17 || brew install postgresql

    # Lier la version 17 si elle a été installée
    if brew list postgresql@17 &>/dev/null; then
      brew link --force postgresql@17
    fi
  fi

  # Vérifier l'installation
  if ! check_command psql; then
    echo "Échec de l'installation de PostgreSQL via Homebrew."
    echo "Autre option: Installer Postgres.app depuis https://postgresapp.com"
    return 1
  fi

  return 0
}

# Fonction pour installer sur Debian/Ubuntu
install_debian() {
  echo "Détection de l'installation sur Debian/Ubuntu..."

  echo "Installation des outils PostgreSQL..."
  sudo apt update && sudo apt install -y postgresql-client

  if [ $? -ne 0 ]; then
    echo "Échec de l'installation des outils PostgreSQL."
    return 1
  fi

  return 0
}

# Fonction pour installer sur Fedora/RHEL/CentOS
install_fedora() {
  echo "Détection de l'installation sur Fedora/RHEL/CentOS..."

  echo "Installation des outils PostgreSQL..."
  sudo dnf install -y postgresql

  if [ $? -ne 0 ]; then
    echo "Échec de l'installation des outils PostgreSQL."
    return 1
  fi

  return 0
}

# Fonction principale
main() {
  # Vérifier si les outils PostgreSQL sont déjà installés
  if check_command psql && check_command pg_dump; then
    echo "Les outils PostgreSQL sont déjà installés."
    echo "Versions installées:"
    psql --version
    pg_dump --version
    return 0
  fi

  # Détecter le système d'exploitation
  OS=$(detect_os)

  case "$OS" in
    "macos")
      install_macos
      ;;
    "debian")
      install_debian
      ;;
    "fedora")
      install_fedora
      ;;
    *)
      echo "Système d'exploitation non pris en charge automatiquement."
      echo "Veuillez installer les outils PostgreSQL manuellement:"
      echo "  - macOS: brew install postgresql"
      echo "  - Debian/Ubuntu: sudo apt install postgresql-client"
      echo "  - Fedora/RHEL/CentOS: sudo dnf install postgresql"
      echo "  - Windows: Télécharger depuis https://www.postgresql.org/download/windows/"
      return 1
      ;;
  esac

  # Vérifier si l'installation a réussi
  if check_command psql && check_command pg_dump; then
    echo "\nLes outils PostgreSQL ont été installés avec succès!"
    echo "Versions installées:"
    psql --version
    pg_dump --version
    return 0
  else
    echo "\nL'installation des outils PostgreSQL a échoué."
    echo "Veuillez les installer manuellement selon les instructions dans scripts/README.md"
    return 1
  fi
}

# Exécuter la fonction principale
main
