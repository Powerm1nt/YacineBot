#!/bin/bash

# Script pour redémarrer le bot Yassine

echo "Redémarrage du bot Yassine..."

# Vérifier si le fichier PID existe
if [ -f "yassinebot.pid" ]; then
  PID=$(cat yassinebot.pid)
  if ps -p $PID > /dev/null; then
    echo "Arrêt de l'instance précédente (PID: $PID)..."
    kill $PID
    sleep 5

    # Vérifier si le processus est toujours en cours d'exécution
    if ps -p $PID > /dev/null; then
      echo "Forçage de l'arrêt..."
      kill -9 $PID
    fi
  else
    echo "Aucune instance en cours d'exécution avec le PID: $PID"
  fi
fi

# Charger les variables d'environnement si le fichier .env existe
if [ -f ".env" ]; then
  echo "Chargement des variables d'environnement depuis .env"
  export $(grep -v '^#' .env | xargs)
fi

# Démarrer le bot en arrière-plan
echo "Démarrage d'une nouvelle instance..."
nohup java -jar yassinebot-1.0.0.jar > yassinebot.log 2>&1 &

# Enregistrer le PID
echo $! > yassinebot.pid

echo "Bot démarré avec le PID: $(cat yassinebot.pid)"
echo "Les logs sont disponibles dans yassinebot.log"
