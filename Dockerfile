FROM node:24 as base
FROM maven:3.8.6-openjdk-17-slim AS build

WORKDIR /app

# Copier les fichiers POM et les sources
COPY pom.xml .
COPY src ./src

# Construire le projet
RUN mvn clean package -DskipTests

# Image finale
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Créer un utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Créer les répertoires nécessaires
RUN mkdir -p /app/logs
RUN chown -R appuser:appgroup /app

# Copier le JAR et les dépendances depuis l'étape de build
COPY --from=build /app/target/*.jar /app/yassinebot.jar
COPY --from=build /app/target/lib /app/lib

# Copier les scripts
COPY scripts/restart.sh /app/
RUN chmod +x /app/*.sh

# Changer l'utilisateur
USER appuser

# Commande d'entrée
CMD ["java", "-jar", "yassinebot.jar"]
WORKDIR /app

RUN corepack enable

RUN npm install -g pm2

COPY package.json yarn.lock ./

RUN yarn install

# -----------------------------------------------
# Development build
# -----------------------------------------------
FROM base as development
ENV NODE_ENV=development

CMD ["yarn", "dev"]

# -----------------------------------------------
# Production build
# -----------------------------------------------
FROM base as production
ENV NODE_ENV=production

COPY . .

RUN yarn prisma:generate

RUN echo '#!/bin/sh\n\
if [ -n "$DATABASE_URL" ]; then\n\
  echo "Running Prisma migrations..."\n\
  yarn prisma:migrate || echo "Migrations skipped or already applied"\n\
fi\n\
\n\
# Start the application with PM2\n\
pm2-runtime start src/app.js --name app' > /app/startup.sh \
  && chmod +x /app/startup.sh

CMD ["/app/startup.sh"]
