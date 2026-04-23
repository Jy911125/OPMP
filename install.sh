#!/bin/bash

#===============================================================================
# OPMP 虚拟数字监控平台 - 一键安装脚本
# 适用于 Ubuntu 24.04 LTS
# GitHub: https://github.com/Jy911125/OPMP.git
#
# 用法:
#   方式1 (推荐): 克隆仓库后执行
#     git clone https://github.com/Jy911125/OPMP.git
#     cd OPMP
#     sudo bash install.sh
#
#   方式2: 直接下载安装 (自动克隆)
#     curl -fsSL https://raw.githubusercontent.com/Jy911125/OPMP/main/install.sh | sudo bash
#===============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目信息
PROJECT_NAME="OPMP"
PROJECT_DIR="/opt/opmp"
GITHUB_REPO="https://github.com/Jy911125/OPMP.git"
GITHUB_RAW="https://raw.githubusercontent.com/Jy911125/OPMP/main"
COMPOSE_FILE="docker-compose.yml"

# 安装模式
INSTALL_MODE="local"  # local | clone | remote

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行，请使用: sudo bash install.sh"
        exit 1
    fi
}

# 更新系统
update_system() {
    log_info "更新系统包索引..."
    apt-get update -qq
    log_success "系统包索引已更新"
}

# 检查系统版本
check_system() {
    log_info "检查系统环境..."

    if [[ ! -f /etc/os-release ]]; then
        log_error "无法检测系统版本"
        exit 1
    fi

    . /etc/os-release

    if [[ "$ID" != "ubuntu" ]]; then
        log_warning "此脚本主要针对Ubuntu系统，当前系统: $ID"
        log_warning "在其他系统上可能需要手动安装依赖"
        read -p "是否继续安装? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "系统检测通过: $PRETTY_NAME"
}

# 检测安装模式
detect_install_mode() {
    log_info "检测安装模式..."

    # 获取脚本所在目录
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # 检查是否在项目目录中执行
    if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]] && [[ -d "$SCRIPT_DIR/server" ]] && [[ -d "$SCRIPT_DIR/client" ]]; then
        INSTALL_MODE="local"
        log_info "检测到本地项目文件，使用本地安装模式"
    elif command -v git &> /dev/null; then
        INSTALL_MODE="clone"
        log_info "未检测到本地项目，将使用git克隆安装"
    else
        log_error "未找到项目文件，且未安装git"
        log_info "请先安装git: apt-get install git"
        log_info "然后克隆项目: git clone $GITHUB_REPO"
        exit 1
    fi
}

# 检测并安装依赖
install_dependencies() {
    log_step "安装基础依赖..."

    apt-get install -y -qq \
        git \
        curl \
        wget \
        ca-certificates \
        gnupg \
        lsb-release \
        software-properties-common \
        apt-transport-https \
        openssl \
        vim \
        htop \
        net-tools

    log_success "基础依赖安装完成"
}

# 检查并安装Docker
install_docker() {
    log_step "检查Docker环境..."

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version 2>/dev/null || echo "unknown")
        log_success "Docker已安装: $DOCKER_VERSION"

        # 确保Docker服务运行
        if ! systemctl is-active --quiet docker; then
            log_info "启动Docker服务..."
            systemctl start docker
        fi
        return 0
    fi

    log_info "Docker未安装，正在安装Docker..."

    # 添加Docker官方GPG密钥
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # 设置Docker仓库
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # 安装Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # 启动并启用Docker
    systemctl start docker
    systemctl enable docker

    # 添加当前用户到docker组（如果需要）
    if [[ -n "$SUDO_USER" ]]; then
        usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    fi

    log_success "Docker安装完成: $(docker --version)"
}

# 检查并安装Docker Compose
install_docker_compose() {
    log_step "检查Docker Compose..."

    # Docker Compose V2 (docker compose)
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        log_success "Docker Compose已安装: $COMPOSE_VERSION"
        return 0
    fi

    # Docker Compose V1 (docker-compose)
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        log_success "Docker Compose V1已安装: $COMPOSE_VERSION"
        return 0
    fi

    # 安装Docker Compose V1作为备用
    log_info "安装Docker Compose..."
    apt-get install -y -qq docker-compose

    log_success "Docker Compose安装完成"
}

# 克隆项目
clone_project() {
    log_step "克隆项目代码..."

    if [[ "$INSTALL_MODE" == "clone" ]]; then
        log_info "从GitHub克隆项目: $GITHUB_REPO"

        # 删除旧目录（如果存在）
        rm -rf "$PROJECT_DIR"

        # 克隆项目
        git clone "$GITHUB_REPO" "$PROJECT_DIR"

        log_success "项目克隆完成"
    elif [[ "$INSTALL_MODE" == "local" ]]; then
        log_info "复制本地项目文件..."

        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

        # 创建目标目录
        mkdir -p "$PROJECT_DIR"

        # 复制项目文件
        cp -r "$SCRIPT_DIR/server" "$PROJECT_DIR/"
        cp -r "$SCRIPT_DIR/client" "$PROJECT_DIR/"
        cp "$SCRIPT_DIR/docker-compose.yml" "$PROJECT_DIR/"
        cp "$SCRIPT_DIR/install.sh" "$PROJECT_DIR/" 2>/dev/null || true
        cp "$SCRIPT_DIR/uninstall.sh" "$PROJECT_DIR/" 2>/dev/null || true
        cp "$SCRIPT_DIR"/*.md "$PROJECT_DIR/" 2>/dev/null || true
        cp "$SCRIPT_DIR/.env.example" "$PROJECT_DIR/server/" 2>/dev/null || true

        log_success "项目文件复制完成"
    fi
}

# 创建必要目录
create_directories() {
    log_step "创建数据目录..."

    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/data"
    mkdir -p /var/log/opmp

    chmod 777 /var/log/opmp

    log_success "目录创建完成"
}

# 配置环境变量
configure_environment() {
    log_step "配置环境变量..."

    ENV_FILE="$PROJECT_DIR/.env"

    # 检查是否已有配置
    if [[ -f "$ENV_FILE" ]]; then
        log_info "发现现有环境配置，是否覆盖?"
        read -p "覆盖现有配置? (y/n，默认n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && return 0
    fi

    # 生成随机JWT密钥
    JWT_SECRET=$(openssl rand -hex 32)

    # 获取服务器IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    [[ -z "$SERVER_IP" ]] && SERVER_IP="localhost"

    # 创建.env文件
    cat > "$ENV_FILE" << EOF
#===============================================
# OPMP 环境配置文件
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
#===============================================

# 运行环境
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT安全密钥 (请妥善保管!)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# CORS配置
CORS_ORIGIN=http://${SERVER_IP}:8080

# Docker配置
DOCKER_SOCKET=/var/run/docker.sock

# 系统路径
PROC_PATH=/host/proc
SYS_PATH=/host/sys
ETC_PATH=/host/etc

# 监控配置
MONITOR_INTERVAL=3000
MONITOR_HISTORY_SIZE=3600

# 日志配置
LOG_LEVEL=info

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
EOF

    chmod 600 "$ENV_FILE"

    log_success "环境变量配置完成"
    log_info "JWT密钥已自动生成，配置文件: $ENV_FILE"
}

# 构建Docker镜像
build_images() {
    log_step "构建Docker镜像..."

    cd "$PROJECT_DIR"

    # 检查docker compose版本
    if docker compose version &> /dev/null; then
        log_info "使用 docker compose 构建镜像..."
        docker compose build
    else
        log_info "使用 docker-compose 构建镜像..."
        docker-compose build
    fi

    log_success "Docker镜像构建完成"
}

# 启动服务
start_services() {
    log_step "启动OPMP服务..."

    cd "$PROJECT_DIR"

    # 停止可能存在的旧容器
    if docker compose version &> /dev/null; then
        docker compose down --remove-orphans 2>/dev/null || true
        docker compose up -d
    else
        docker-compose down --remove-orphans 2>/dev/null || true
        docker-compose up -d
    fi

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 15

    # 检查服务状态
    if docker ps | grep -q "opmp"; then
        log_success "OPMP服务启动成功"
    else
        log_error "OPMP服务启动失败，请查看日志"
        docker logs opmp-server 2>&1 | tail -50
        docker logs opmp-client 2>&1 | tail -50
        exit 1
    fi
}

# 创建systemd服务
create_systemd_service() {
    log_step "创建系统服务..."

    cat > /etc/systemd/system/opmp.service << EOF
[Unit]
Description=OPMP Virtual Digital Monitoring Platform
Documentation=https://github.com/Jy911125/OPMP
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_DIR
ExecStartPre=-/usr/bin/docker compose down
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable opmp.service

    log_success "系统服务创建完成"
}

# 配置防火墙
configure_firewall() {
    log_step "配置防火墙..."

    if command -v ufw &> /dev/null; then
        # 检查UFW状态
        UFW_STATUS=$(ufw status | head -1)
        log_info "UFW状态: $UFW_STATUS"

        # 添加规则
        ufw allow 8080/tcp comment 'OPMP Web UI' 2>/dev/null || true
        ufw allow 3000/tcp comment 'OPMP API' 2>/dev/null || true

        # 如果UFW已启用，重载配置
        if ufw status | grep -q "active"; then
            ufw reload 2>/dev/null || true
        fi

        log_success "防火墙规则已配置"
    else
        log_info "UFW未安装，跳过防火墙配置"
        log_info "如需配置防火墙，请执行: apt-get install ufw"
    fi
}

# 显示安装信息
show_info() {
    # 获取服务器信息
    SERVER_IP=$(hostname -I | awk '{print $1}')
    [[ -z "$SERVER_IP" ]] && SERVER_IP="localhost"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║     ✅ OPMP 安装完成!                           ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📁 安装信息:${NC}"
    echo "   安装目录: $PROJECT_DIR"
    echo "   配置文件: $PROJECT_DIR/.env"
    echo ""
    echo -e "${CYAN}🌐 访问地址:${NC}"
    echo "   Web UI:  http://${SERVER_IP}:8080"
    echo "   API:     http://${SERVER_IP}:3000"
    echo ""
    echo -e "${CYAN}👤 默认账号:${NC}"
    echo "   管理员:   admin / opmp@2026"
    echo "   操作员:   operator / operator@2026"
    echo "   观察员:   viewer / viewer@2026"
    echo ""
    echo -e "${CYAN}🔧 常用命令:${NC}"
    echo "   查看状态:   docker compose ps"
    echo "   查看日志:   docker compose logs -f"
    echo "   重启服务:   systemctl restart opmp"
    echo "   停止服务:   systemctl stop opmp"
    echo "   卸载:       sudo bash $PROJECT_DIR/uninstall.sh"
    echo ""
    echo -e "${YELLOW}⚠️  安全提示:${NC}"
    echo "   1. 请及时修改默认密码"
    echo "   2. JWT密钥保存在: $PROJECT_DIR/.env"
    echo "   3. 生产环境请确保修改JWT_SECRET"
    echo ""
    echo -e "${GREEN}===================================================${NC}"
    echo ""
}

# 主安装流程
main() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║     OPMP 虚拟数字监控平台 - 安装程序            ║${NC}"
    echo -e "${GREEN}║     适用于 Ubuntu 24.04 LTS                      ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║     GitHub: https://github.com/Jy911125/OPMP     ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    # 执行安装步骤
    check_root
    update_system
    check_system
    detect_install_mode
    install_dependencies
    install_docker
    install_docker_compose
    clone_project
    create_directories
    configure_environment
    build_images
    start_services
    create_systemd_service
    configure_firewall
    show_info
}

# 运行主程序
main "$@"
