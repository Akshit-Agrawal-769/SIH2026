FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
