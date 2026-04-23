# OPMP Client - Vue 3 Frontend
# 阶段1: 构建
FROM node:22-alpine AS builder

LABEL maintainer="OPMP Team"
LABEL version="1.0.0"

WORKDIR /app

# 设置npm国内镜像
RUN npm config set registry https://registry.npmmirror.com

# 复制package文件
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY src ./src
COPY public ./public
COPY index.html ./

# 构建生产版本
RUN npm run build

# 阶段2: 生产镜像
FROM nginx:alpine

LABEL maintainer="OPMP Team"
LABEL version="1.0.0"
LABEL description="OPMP Virtual Digital Monitoring Platform - Client"

# 安装工具
RUN apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
