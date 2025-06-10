FROM node:24 as base

WORKDIR /app

RUN corepack enable

# Installer les dépendances globales
RUN npm install -g pm2

# Copier les fichiers de dépendances
COPY package.json yarn.lock ./

# Installation des dépendances
RUN yarn install --frozen-lockfile

# -----------------------------------------------
# Development build
# -----------------------------------------------
FROM base as development
ENV NODE_ENV=development

# Copier le code source
COPY . .

# Ne pas générer le client Prisma pendant le build pour éviter l'erreur DATABASE_URL

# Exécuter les migrations au démarrage puis lancer l'application
CMD ["sh", "-c", "yarn db:deploy && yarn dev"]

# -----------------------------------------------
# Production build
# -----------------------------------------------
FROM base as production
ENV NODE_ENV=production

# Copier le code source
COPY . .

# Générer le client Prisma pendant le build
RUN yarn db:deploy

# Exécuter les migrations au démarrage puis lancer l'application
CMD ["sh", "-c", "yarn db:deploy && pm2-runtime start src/app.js --name app"]
