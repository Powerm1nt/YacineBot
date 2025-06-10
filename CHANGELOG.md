# Journal des Modifications

## Version 1.0.0 (2025-06-10)

### Modifications majeures

- Migration complète du bot Discord de JavaScript à Java
- Adoption de JDA (Java Discord API) pour l'intégration avec Discord
- Passage de Prisma à Hibernate pour la gestion de la base de données
- Mise en œuvre de Maven comme gestionnaire de dépendances

### Nouvelles fonctionnalités

- Système de gestion des préférences par serveur amélioré
- Configuration Hibernate pour la création automatique du schéma de base de données
- Tests unitaires pour les composants critiques
- Configuration Docker pour un déploiement simplifié
- CI/CD via GitHub Actions pour le déploiement automatique

### Améliorations techniques

- Architecture modulaire avec une meilleure séparation des préoccupations
- Journalisation améliorée avec SLF4J et Logback
- Gestion plus robuste des erreurs et des exceptions
- Utilisation de la programmation orientée objet pour une meilleure maintenabilité
- Documentation complète du code et des processus de déploiement

### Fonctionnalités conservées

- Intégration avec l'API OpenAI pour les conversations contextuelles
- Système de planification des tâches
- Jeux interactifs (morpion, moignon)
- Commandes de modération et d'administration
- Système de statistiques d'utilisation

### Corrections de bugs

- Résolution des problèmes de fuites de mémoire liés aux conversations prolongées
- Amélioration de la gestion des messages Discord longs
- Correction des problèmes de timing dans les messages automatiques
- Résolution des problèmes de synchronisation dans le planificateur de tâches

## Prochaines étapes

- Ajout de nouvelles commandes et fonctionnalités
- Amélioration continue des performances
- Extension des capacités d'IA avec de nouveaux modèles
- Interface web d'administration (prévue pour la version 1.1.0)
