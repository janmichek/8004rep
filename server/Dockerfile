FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787
ENV DB_PATH=/data/8004rep.db

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY server ./server

RUN mkdir -p /data
VOLUME /data
EXPOSE 8787

CMD ["npx", "tsx", "server/src/index.ts"]
