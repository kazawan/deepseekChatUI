# 构建阶段
FROM node:18-alpine as builder
WORKDIR /app
COPY aichat/package*.json ./
RUN npm install
COPY aichat/ ./
RUN npm run build

# 运行阶段
FROM node:18-alpine
WORKDIR /app
COPY static_server/package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./public
COPY static_server/index.js .
COPY .env ../.env

EXPOSE ${FRONTEND_PORT}
CMD ["node", "index.js"] 