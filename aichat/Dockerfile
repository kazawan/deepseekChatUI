# 构建阶段
FROM node:18-alpine as builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 生产阶段
FROM node:18-alpine

# 安装 PM2 和 serve
RUN npm install -g pm2 serve

# 设置工作目录
WORKDIR /app

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist

# 复制 PM2 配置文件
COPY ecosystem.config.js .

# 暴露端口
EXPOSE 3030

# 启动服务
# CMD ["pm2-runtime", "ecosystem.config.js"] 
CMD ["pm2-runtime", "ecosystem.config.js"]