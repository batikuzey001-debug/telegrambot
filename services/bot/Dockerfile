FROM node:18-alpine
WORKDIR /app
COPY services/bot/package*.json ./
RUN npm ci --omit=dev
COPY services/bot/. .
ENV NODE_ENV=production
# Tek instance için webhook kapatmayı unutmayın
# RUN apk add --no-cache curl && curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" || true
CMD ["node","index.js"]
