FROM node:18-alpine
WORKDIR /app
COPY services/api/package*.json ./
RUN npm ci --omit=dev
COPY services/api/. .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","index.js"]
