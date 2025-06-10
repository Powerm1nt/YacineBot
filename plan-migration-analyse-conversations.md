# Plan de migration et d'analyse des conversations

## Objectifs

1. Ajouter des fonctionnalités d'analyse de pertinence aux conversations
2. Implémenter le partage de conversations entre utilisateurs
3. Migrer les données existantes vers le nouveau format

## Étapes techniques

### 1. Mise à jour du schéma de la base de données

- Ajouter un score de pertinence aux conversations (`relevance_score`)
- Ajouter un résumé des sujets de la conversation (`topic_summary`)
- Ajouter des champs pour le partage de conversations (`is_shared`, `shared_with`)
- Ajouter un score de pertinence à chaque message (`relevance_score`)
- Ajouter un indicateur pour les messages contenant des informations clés (`has_key_info`)

### 2. Création des services d'analyse

Le service d'analyse doit permettre de :
- Évaluer la pertinence d'un message individuel
- Analyser une conversation complète
- Générer un résumé des sujets de la conversation
- Partager une conversation avec d'autres utilisateurs

### 3. Migration des données existantes

- Créer un script d'analyse des conversations existantes
- Exécuter l'analyse en arrière-plan sans perturber le service

### 4. Fonctionnalités utilisateur

- Commande `/conversations share @utilisateur` pour partager une conversation
- Commande `/conversations list` pour voir les conversations partagées avec l'utilisateur

## Tâches à réaliser

- [x] Créer la migration Prisma pour les nouveaux champs
- [x] Développer le service d'analyse de pertinence
- [x] Créer le script de migration des données existantes
- [x] Implémenter les commandes de partage de conversations
- [x] Mettre à jour les services et utilitaires existants
- [ ] Tester la migration et les nouvelles fonctionnalités
- [ ] Déployer les changements en production

## Tests

1. Vérifier que les scores de pertinence sont correctement calculés
2. Vérifier que le partage de conversations fonctionne entre utilisateurs
3. Vérifier que les conversations existantes sont correctement migrées

## Déploiement

1. Exécuter la migration de base de données
2. Déployer les nouveaux services et commandes
3. Exécuter le script d'analyse des conversations existantes
4. Surveiller les performances et ajuster si nécessaire
