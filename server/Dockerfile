# OPMP Server - Node.js Backend with Frontend
# 多阶段构建: 前端构建 + 后端构建

# 构建参数：npm registry (默认国内源，可通过--build-arg覆盖)
ARG NPM_REGISTRY=https://registry.npmmirror.com

#===============================================
# 阶段1: 构建前端
#===============================================
FROM node:24-alpine AS frontend-builder

LABEL maintainer="OPMP Team"
LABEL stage="frontend-builder"

# 接收构建参数
ARG NPM_REGISTRY

WORKDIR /app/client

# 设置npm镜像
RUN npm config set registry ${NPM_REGISTRY}

# 复制前端依赖文件
COPY client/package*.json ./
COPY client/tsconfig.json ./
COPY client/tsconfig.node.json ./
COPY client/vite.config.ts ./

# 安装前端依赖（使用install而非ci，兼容无锁文件情况）
RUN npm install --prefer-offline --no-audit

# 复制前端源代码
COPY client/src ./src
COPY client/public ./public
COPY client/index.html ./

# 构建前端
RUN npm run build

#===============================================
# 阶段2: 构建后端
#===============================================
FROM node:24-alpine AS backend-builder

LABEL maintainer="OPMP Team"
LABEL stage="backend-builder"

# 接收构建参数
ARG NPM_REGISTRY

WORKDIR /app

# 设置npm镜像
RUN npm config set registry ${NPM_REGISTRY}

# 安装系统依赖
RUN apk add --no-cache curl bash procps sudo

# 复制后端依赖文件
COPY server/package*.json ./
COPY server/tsconfig.json ./

# 安装所有依赖（包括devDependencies用于构建）
RUN npm install --prefer-offline --no-audit

# 复制后端源代码
COPY server/src ./src

# 构建TypeScript
RUN npm run build

#===============================================
# 阶段3: 生产镜像
#===============================================
FROM node:24-alpine

LABEL maintainer="OPMP Team"
LABEL version="1.1.4"
LABEL description="OPMP Virtual Digital Monitoring Platform - Server"

# 接收构建参数
ARG NPM_REGISTRY

# 安装系统依赖
RUN apk add --no-cache curl bash procps sudo iproute2

# 创建应用目录
WORKDIR /app

# 复制package文件
COPY server/package*.json ./

# 只安装生产依赖（使用默认源，生产环境无需镜像加速）
RUN npm install --only=production --prefer-offline --no-audit

# 从构建阶段复制后端产物
COPY --from=backend-builder /app/dist ./dist

# 从构建阶段复制前端产物
COPY --from=frontend-builder /app/client/dist ./public

# 创建日志目录
RUN mkdir -p /var/log/opmp && chmod 777 /var/log/opmp

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动服务 (使用root运行以访问Docker socket和执行sudo命令)
CMD ["node", "dist/app.js"]
