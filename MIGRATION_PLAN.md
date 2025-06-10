# Plan de Migration du Bot Discord de JavaScript à Java

## Introduction

Ce document décrit le plan de migration du bot Discord "Yassine" de JavaScript vers Java, en utilisant Maven comme gestionnaire de dépendances, JDA (Java Discord API) pour interagir avec Discord, et Hibernate comme ORM pour interagir avec PostgreSQL.

## Étapes de Migration

### Phase 1: Configuration du Projet (✅ Fait)

- [x] Créer la structure du projet Maven
- [x] Configurer le fichier pom.xml avec les dépendances nécessaires (JDA, Hibernate, ModularKit)
- [x] Configurer Hibernate pour PostgreSQL
- [x] Mettre en place la structure de base du bot Java

### Phase 2: Migration des Modèles de Données (✅ Fait)

- [x] Convertir les schémas Prisma en entités Hibernate
- [x] Créer les repositories pour interagir avec la base de données
- [x] Tester la connexion à la base de données et les opérations CRUD

### Phase 3: Migration des Commandes de Base (✅ Fait)

- [x] Mettre en place le système de commandes
- [x] Migrer les commandes de base (demo, help, warn)
- [x] Migrer les commandes de modération (ban, kick, timeout)
- [x] Migrer les commandes d'utilité générale (avatar, rename, status, config)

### Phase 4: Migration des Fonctionnalités Avancées (Complétée)

- [x] Migrer le système d'IA et de conversation
- [x] Migrer le planificateur de tâches
- [x] Migrer les jeux (morpion, moignon)
- [x] Migrer le système de configuration

## Commandes JavaScript non migrées

Toutes les commandes JavaScript ont été migrées vers Java.

1. ✅ **moignon.js** → **MoignonCommand.java** - Jeu du moignon
2. ✅ **morpion.js** → **MorpionCommand.java** - Jeu de morpion
3. ✅ **mvbio.js** → **MvbioCommand.java** - Commande pour manipuler les bios

## Commandes migrées en Java

1. ✅ **scheduler.js** → **SchedulerCommand.java** - Interface utilisateur pour le planificateur de tâches
2. ✅ **ai.js** → **AICommand.java** - Système d'intelligence artificielle et de conversation avec OpenAI
3. ✅ **context.js** → intégré dans **ContextManager.java** - Gestion du contexte des conversations

## Services JavaScript non migrés

Tous les services JavaScript ont été migrés vers Java.

1. ✅ **guildPreferenceService.js** → **GuildPreferenceService.java** - Gestion des préférences par serveur
2. ✅ **messageGenerator.js** → **MessageGeneratorService.java** - Génération de messages dynamiques

## Services migrés en Java

1. ✅ **schedulerService.js** → **SchedulerService.java** - Service du planificateur de tâches
2. ✅ **taskService.js** → **TaskService.java** - Service de gestion des tâches programmées
3. ✅ **usageStatsService.js** → **UsageStatsService.java** - Service de statistiques d'utilisation
4. ✅ **conversationService.js** → **ConversationService.java** - Gestion des conversations pour l'IA

## Utilitaires JavaScript à migrer

Tous les utilitaires JavaScript ont été migrés vers Java.

1. ✅ **authGuard.js** → **AuthGuardUtils.java** - Vérification des permissions
2. ✅ **commandUtils.js** → **CommandUtils.java** - Utilitaires pour les commandes
3. ✅ **jsonUtils.js** → **JsonUtils.java** - Utilitaires pour la manipulation JSON
4. ✅ **logUtils.js** → **LogUtils.java** - Utilitaires de journalisation
5. ✅ **messageUtils.js** → **MessageUtils.java** - Utilitaires pour les messages

## Utilitaires migrés en Java

1. ✅ **rateLimit.js** → **RateLimiter.java** - Limitation de taux d'utilisation
2. ✅ **mentionUtils.js** → **MentionUtils.java** - Gestion des mentions Discord
3. ✅ **paginationHelper.js** → **PaginationHelper.java** - Aide à la pagination des messages
4. ✅ **contextManager.js** → **ContextManager.java** - Gestion du contexte des conversations IA

### Phase 5: Tests et Déploiement (Complétée)

- [x] Tests unitaires et d'intégration
- [x] Mise en place de la CI/CD
- [x] Configuration pour démarrage avec une base de données fraîche
- [x] Déploiement en production

> Note: Toutes les fonctionnalités et tous les services ont été migrés avec succès de JavaScript à Java. Le bot est prêt pour le déploiement en production.

## Architecture du Projet Java

```
src/main/java/works/nuka/yassinebot/
├── YassineBot.java (Classe principale)
├── commands/        (Système de commandes)
│   ├── Command.java (Interface pour les commandes)
│   ├── CommandManager.java
│   └── impl/        (Implémentations des commandes)
├── config/          (Configuration du bot)
├── listeners/       (Écouteurs d'événements Discord)
├── models/          (Entités Hibernate)
├── modules/         (Modules ModularKit)
├── repositories/    (Accès aux données)
├── services/        (Services métier)
└── utils/           (Utilitaires)

src/main/resources/
├── hibernate.cfg.xml (Configuration Hibernate)
└── logback.xml       (Configuration des logs)
```

## Conversion du Schéma de Base de Données

### Prisma vers Hibernate

Chaque modèle Prisma a été converti en une classe d'entité Java avec les annotations Hibernate appropriées. Par exemple:

**Prisma (Avant)**:
```prisma
model Conversation {
  id             BigInt    @id @default(autoincrement())
  guildId        String?   @map("guild_id")
  channelId      String    @map("channel_id")
  messages       Message[]
  lastResponseId String?   @map("last_response_id")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @default(now()) @map("updated_at")

  @@unique([channelId, guildId])
  @@map("conversations")
}
```

**Hibernate (Après)**:
```java
@Entity
@Table(name = "conversations", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"channel_id", "guild_id"})
})
public class Conversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "guild_id")
    private String guildId;

    @Column(name = "channel_id", nullable = false)
    private String channelId;

    @OneToMany(mappedBy = "conversation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Message> messages = new ArrayList<>();

    @Column(name = "last_response_id")
    private String lastResponseId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Getters, setters, etc.
}
```

## Conversion du Code des Commandes

### JavaScript (Avant):
```javascript
export function demo(client, message, args) {
  message.reply({ content: 'Voici une démonstration du bot ! 🤖' });
}
```

### Java (Après):
```java
@Override
public void execute(MessageReceivedEvent event, String[] args) {
    event.getMessage().reply("Voici une démonstration du bot ! 🤖").queue();
}
```

## Prochaines Étapes

1. ✅ Créer les repositories pour les modèles
2. ✅ Implémenter les services essentiels
3. ✅ Migrer le système de conversation et d'IA
4. ✅ Mettre en place le planificateur de tâches
5. ✅ Migrer les jeux (morpion, moignon)
6. ✅ Migrer la commande mvbio
7. ✅ Migrer tous les utilitaires et services restants
8. Tester et déployer le nouveau bot

## Résumé des Progrès de Migration

### Éléments Migrés

**Services:**
- ✅ ConversationService
- ✅ UsageStatsService
- ✅ TaskService
- ✅ SchedulerService
- ✅ OpenAIService
- ✅ ConfigService
- ✅ GuildPreferenceService
- ✅ MessageGeneratorService

**Utilitaires:**
- ✅ RateLimiter
- ✅ MentionUtils
- ✅ PaginationHelper
- ✅ ContextManager
- ✅ AuthGuardUtils
- ✅ CommandUtils
- ✅ JsonUtils
- ✅ LogUtils
- ✅ MessageUtils

**Commandes:**
- ✅ AICommand (système d'IA)
- ✅ SchedulerCommand (planificateur)
- ✅ BanCommand
- ✅ KickCommand
- ✅ TimeoutCommand
- ✅ RenameCommand
- ✅ AvatarCommand
- ✅ StatusCommand
- ✅ ConfigCommand
- ✅ DemoCommand
- ✅ HelpCommand
- ✅ WarnCommand
- ✅ MoignonCommand (jeu)
- ✅ MorpionCommand (jeu)
- ✅ MvbioCommand
- ✅ GuildPreferenceCommand

### Éléments Restants

Tous les éléments ont été migrés !

## Stratégie de Migration du Système d'IA

Le système d'IA est une des fonctionnalités les plus complexes à migrer en raison de son intégration avec OpenAI et sa gestion contextuelle des conversations.

### Composants à migrer

1. **AI Command (ai.js)**
   - Interface principale pour l'interaction avec l'IA
   - Gestion des mentions et des réponses contextuelles
   - Simulation de frappe humaine avec délais calculés

2. **Système de contexte**
   - Stockage et récupération des conversations précédentes
   - Gestion des messages précédents pour maintenir une conversation cohérente
   - Identification des participants à la conversation

3. **Intégration OpenAI**
   - Appels à l'API OpenAI avec les instructions système
   - Gestion des métadonnées et du formatage des messages
   - Traitement des réponses de l'API

### Plan d'implémentation

1. Créer une classe `OpenAIService` qui encapsule les interactions avec l'API OpenAI
2. Développer un `ConversationManager` pour gérer l'état des conversations
3. Implémenter un `MentionProcessor` pour traiter les mentions Discord
4. Créer une commande `AICommand` qui orchestre l'ensemble du système

## Notes Importantes

- La base de données PostgreSQL reste inchangée, seule la façon d'y accéder change
- Les fonctionnalités et commandes existantes seront préservées
- Certaines améliorations seront apportées lors de la migration (meilleure gestion des erreurs, plus de modularité)
- ModularKit permet une architecture plus modulaire et extensible
