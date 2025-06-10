FROM node:24 as base

WORKDIR /app

RUN corepack enable

RUN npm install -g pm2

COPY package.json yarn.lock ./

RUN yarn install

# -----------------------------------------------
# Build de développement
# -----------------------------------------------
FROM base as development
ENV NODE_ENV=development

CMD ["yarn", "dev"]

# -----------------------------------------------
# Build de production
# -----------------------------------------------
FROM base as production
ENV NODE_ENV=production

COPY . .

RUN yarn prisma:generate

CMD ["pm2-runtime", "start", "src/app.js", "--name", "app"]
