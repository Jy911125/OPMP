# OPMP Server - Node.js Backend
# 使用阿里云镜像加速
FROM node:24-alpine

LABEL maintainer="OPMP Team"
LABEL version="1.0.0"
LABEL description="OPMP Virtual Digital Monitoring Platform - Server"

# 设置npm国内镜像
RUN npm config set registry https://registry.npmmirror.com

# 安装系统依赖
RUN apk add --no-cache \
    curl \
    bash \
    procps \
    sudo

# 创建应用目录
WORKDIR /app

# 复制package文件（利用Docker缓存）
COPY package*.json ./
COPY tsconfig.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY src ./src

# 构建TypeScript
RUN npm run build

# 创建日志目录
RUN mkdir -p /var/log/opmp && chmod 777 /var/log/opmp

# 创建非root用户
RUN addgroup -S opmp && adduser -S opmp -G opmp

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动服务
USER opmp
CMD ["node", "dist/app.js"]
