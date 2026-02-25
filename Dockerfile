FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

# Railway uses $PORT env var
EXPOSE ${PORT:-3456}

CMD ["node", "server.js"]
