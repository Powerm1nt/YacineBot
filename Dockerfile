FROM node:24 as base

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
