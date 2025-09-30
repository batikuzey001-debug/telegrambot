FROM node:18-alpine
WORKDIR /app

# Bu Dockerfile services/api içinde olduğu için yerel yolları kullan
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","index.js"]
