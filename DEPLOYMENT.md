# Guide de Déploiement du Bot Discord Yassine

Ce document décrit les différentes méthodes pour déployer le bot Discord Yassine.

## Prérequis

- JDK 17 ou supérieur
- Maven
- PostgreSQL
- Un token de bot Discord
- Une clé API OpenAI

## Méthode 1: Déploiement Manuel

### Étape 1: Construire le projet

```bash
# Cloner le dépôt
git clone https://github.com/votre-nom/yassinebot.git
cd yassinebot

# Construire avec Maven
mvn clean package
```

### Étape 2: Configurer l'environnement

```bash
# Copier le fichier d'exemple .env
cp .env.example .env

# Éditer le fichier avec vos informations
nano .env
```

### Étape 3: Configurer la base de données

```bash
# Assurez-vous que votre base de données PostgreSQL est prête
# Le schéma sera créé automatiquement par Hibernate lors du premier lancement
```

### Étape 4: Démarrer le bot

```bash
# Rendre le script exécutable
chmod +x scripts/restart.sh

# Démarrer le bot
./scripts/restart.sh
```

## Méthode 2: Déploiement avec Docker

### Étape 1: Configurer l'environnement

```bash
# Copier le fichier d'exemple .env
cp .env.example .env

# Éditer le fichier avec vos informations
nano .env
```

### Étape 2: Démarrer avec Docker Compose

```bash
# Construire et démarrer les conteneurs
docker-compose up -d

# Exécuter la migration (si nécessaire)
docker-compose exec yassinebot ./run-migration.sh
```

## Méthode 3: Déploiement Automatique avec GitHub Actions

### Étape 1: Configurer les secrets GitHub

Dans les paramètres du dépôt GitHub, ajoutez les secrets suivants:

- `SSH_PRIVATE_KEY`: Votre clé SSH privée pour accéder au serveur
- `SSH_HOST`: L'adresse de votre serveur
- `SSH_USER`: Le nom d'utilisateur SSH
- `DEPLOY_PATH`: Le chemin où déployer le bot sur le serveur

### Étape 2: Configurer le serveur

Sur votre serveur, créez un fichier `.env` dans le répertoire de déploiement avec les mêmes variables que dans l'exemple.

### Étape 3: Déclencher le déploiement

Le déploiement se déclenche automatiquement lors d'un push sur la branche `main`. Vous pouvez également le déclencher manuellement depuis l'onglet Actions de GitHub.

## Surveillance et Maintenance

### Logs

Les logs sont disponibles dans le fichier `yassinebot.log` à la racine du projet, ou dans le répertoire `logs/` si vous utilisez Docker.

### Redémarrage

```bash
# Redémarrer manuellement
./scripts/restart.sh

# Avec Docker
docker-compose restart yassinebot
```

### Mise à jour

```bash
# Mise à jour manuelle
git pull
mvn clean package
./scripts/restart.sh

# Avec Docker
git pull
docker-compose build yassinebot
docker-compose up -d yassinebot
```

## Résolution des problèmes

### Vérifier l'état du bot

```bash
# Vérifier si le processus est en cours d'exécution
ps aux | grep yassinebot

# Avec Docker
docker-compose ps
```

### Consulter les logs

```bash
# Afficher les dernières lignes du log
tail -n 100 yassinebot.log

# Avec Docker
docker-compose logs -f yassinebot
```

### Problèmes de base de données

```bash
# Vérifier la connexion à PostgreSQL
psql -h localhost -U postgres -d yassinebot -c "SELECT 'Connexion réussie';"

# Avec Docker
docker-compose exec postgres psql -U postgres -d yassinebot -c "SELECT 'Connexion réussie';"
```

En cas de problème persistant, vérifiez les logs pour des erreurs spécifiques et assurez-vous que toutes les variables d'environnement sont correctement configurées.
