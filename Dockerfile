# ---- 构建前端 ----
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 构建后端 ----
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- 运行环境 ----
FROM node:20-alpine
# 安装时区数据
RUN apk add --no-cache tzdata
WORKDIR /app
# 复制编译后的代码
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/package*.json ./
# [新增] 复制 Drizzle 配置文件和源码(用于建表)
COPY --from=server-build /app/server/drizzle.config.ts ./
COPY --from=server-build /app/server/tsconfig.json ./
COPY --from=server-build /app/server/src ./src

# 复制前端静态文件
COPY --from=client-build /app/client/dist ./public
EXPOSE 3001
CMD ["npm", "start"]
