#!/bin/bash

#===============================================================================
# OPMP 虚拟数字监控平台 - 一键安装脚本
# 适用于 Ubuntu 24.04 LTS
# GitHub: https://github.com/Jy911125/OPMP.git
#
# 用法:
#   方式1 (一键安装 - 推荐):
#     curl -fsSL https://raw.githubusercontent.com/Jy911125/OPMP/main/install.sh | sudo bash
#
#   方式2 (克隆后安装):
#     git clone https://github.com/Jy911125/OPMP.git
#     cd OPMP && sudo bash install.sh
#===============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 项目信息
PROJECT_NAME="OPMP"
PROJECT_DIR="/opt/opmp"
GITHUB_REPO="https://github.com/Jy911125/OPMP.git"

# 安装模式
INSTALL_MODE="clone"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

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
        read -p "是否继续安装? (y/n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
    fi

    log_success "系统检测通过: $PRETTY_NAME"
}

# 安装基础依赖（包含git，支持curl方式安装）
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

# 检测安装模式
detect_install_mode() {
    log_info "检测安装模式..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || SCRIPT_DIR="/tmp"

    # 检查是否在项目目录中执行（本地克隆后安装）
    if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]] && \
       [[ -d "$SCRIPT_DIR/server" ]] && \
       [[ -d "$SCRIPT_DIR/client" ]]; then
        INSTALL_MODE="local"
        log_info "检测到本地项目文件 → 本地安装模式"
    else
        INSTALL_MODE="clone"
        log_info "未检测到本地项目 → 自动克隆模式"
    fi
}

# 检查并安装Docker
install_docker() {
    log_step "检查Docker环境..."

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version 2>/dev/null || echo "unknown")
        log_success "Docker已安装: $DOCKER_VERSION"

        if ! systemctl is-active --quiet docker; then
            log_info "启动Docker服务..."
            systemctl start docker
        fi

        # 检查并配置镜像加速
        if [[ ! -f /etc/docker/daemon.json ]] || ! grep -q "registry-mirrors" /etc/docker/daemon.json 2>/dev/null; then
            configure_docker_mirror
        fi

        return 0
    fi

    log_info "Docker未安装，正在安装Docker..."

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl start docker
    systemctl enable docker

    # 配置Docker国内镜像加速
    configure_docker_mirror

    if [[ -n "$SUDO_USER" ]]; then
        usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    fi

    log_success "Docker安装完成: $(docker --version)"
}

# 配置Docker镜像加速
configure_docker_mirror() {
    log_info "配置Docker镜像加速..."

    mkdir -p /etc/docker

    cat > /etc/docker/daemon.json << 'EOF'
{
    "registry-mirrors": [
        "https://docker.1ms.run",
        "https://docker.xuanyuan.me"
    ],
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2"
}
EOF

    systemctl daemon-reload
    systemctl restart docker

    log_success "Docker镜像加速配置完成"
}

# 检查并安装Docker Compose
install_docker_compose() {
    log_step "检查Docker Compose..."

    if docker compose version &> /dev/null; then
        log_success "Docker Compose已安装: $(docker compose version)"
        return 0
    fi

    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose V1已安装: $(docker-compose --version)"
        return 0
    fi

    log_info "安装Docker Compose..."
    apt-get install -y -qq docker-compose
    log_success "Docker Compose安装完成"
}

# 克隆或复制项目
prepare_project() {
    log_step "准备项目文件..."

    if [[ "$INSTALL_MODE" == "clone" ]]; then
        log_info "从GitHub克隆项目: $GITHUB_REPO"
        rm -rf "$PROJECT_DIR"
        git clone "$GITHUB_REPO" "$PROJECT_DIR"

        # 切换到最新tag版本
        cd "$PROJECT_DIR"
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git tag -l | sort -V | tail -1 || echo "")
        if [[ -n "$LATEST_TAG" ]]; then
            git checkout "$LATEST_TAG" 2>/dev/null || true
            log_info "已切换到最新版本: $LATEST_TAG"
        fi

        log_success "项目克隆完成 (版本: ${LATEST_TAG:-main})"
    else
        log_info "准备本地项目..."
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

        # 如果脚本目录已经是目标目录，无需复制
        if [[ "$SCRIPT_DIR" == "$PROJECT_DIR" ]]; then
            log_success "项目文件已就位 (已在安装目录)"
        else
            mkdir -p "$PROJECT_DIR"
            cp -r "$SCRIPT_DIR/server" "$PROJECT_DIR/"
            cp -r "$SCRIPT_DIR/client" "$PROJECT_DIR/"
            cp "$SCRIPT_DIR/docker-compose.yml" "$PROJECT_DIR/"
            cp "$SCRIPT_DIR/install.sh" "$PROJECT_DIR/" 2>/dev/null || true
            cp "$SCRIPT_DIR/uninstall.sh" "$PROJECT_DIR/" 2>/dev/null || true
            cp "$SCRIPT_DIR/update.sh" "$PROJECT_DIR/" 2>/dev/null || true
            cp "$SCRIPT_DIR/server/.env.example" "$PROJECT_DIR/server/" 2>/dev/null || true
            log_success "项目文件复制完成"
        fi
    fi
}

# 创建必要目录
create_directories() {
    log_step "创建数据目录..."
    mkdir -p "$PROJECT_DIR/logs" "$PROJECT_DIR/data" /var/log/opmp
    chmod 777 /var/log/opmp
    log_success "目录创建完成"
}

# 配置环境变量
configure_environment() {
    log_step "配置环境变量..."

    ENV_FILE="$PROJECT_DIR/.env"

    if [[ -f "$ENV_FILE" ]]; then
        log_info "发现现有环境配置"
        read -p "覆盖现有配置? (y/n，默认n): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && return 0
    fi

    JWT_SECRET=$(openssl rand -hex 32)
    SERVER_IP=$(hostname -I | awk '{print $1}')
    [[ -z "$SERVER_IP" ]] && SERVER_IP="localhost"

    # 检测局域网IP (192.168.0.0/16)
    LAN_IP=$(ip -4 addr show | grep -oP '192\.168\.\d+\.\d+' | head -1)
    if [[ -z "$LAN_IP" ]]; then
        # 未检测到192.168.x.x网段，尝试10.x.x.x或172.16-31.x.x
        LAN_IP=$(ip -4 addr show | grep -oP '(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)' | head -1)
    fi
    if [[ -z "$LAN_IP" ]]; then
        LAN_IP="0.0.0.0"
        log_warning "未检测到局域网IP，默认绑定所有接口"
    else
        log_info "检测到局域网IP: $LAN_IP"
    fi

    cat > "$ENV_FILE" << EOF
# OPMP 环境配置 - $(date '+%Y-%m-%d %H:%M:%S')

NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 局域网绑定 (默认192.168.0.0/16)
LAN_IP=${LAN_IP}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://${SERVER_IP}:3000

DOCKER_SOCKET=/var/run/docker.sock
PROC_PATH=/host/proc
SYS_PATH=/host/sys
ETC_PATH=/host/etc

MONITOR_INTERVAL=3000
MONITOR_HISTORY_SIZE=3600
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
EOF

    chmod 600 "$ENV_FILE"
    log_success "环境变量配置完成 (局域网绑定: ${LAN_IP})"
}

# 构建Docker镜像
build_images() {
    log_step "构建Docker镜像..."
    cd "$PROJECT_DIR"

    if docker compose version &> /dev/null; then
        docker compose build
    else
        docker-compose build
    fi
    log_success "Docker镜像构建完成"
}

# 启动服务
start_services() {
    log_step "启动OPMP服务..."
    cd "$PROJECT_DIR"

    if docker compose version &> /dev/null; then
        docker compose down --remove-orphans 2>/dev/null || true
        docker compose up -d
    else
        docker-compose down --remove-orphans 2>/dev/null || true
        docker-compose up -d
    fi

    log_info "等待服务启动..."
    sleep 15

    if docker ps | grep -q "opmp"; then
        log_success "OPMP服务启动成功"
    else
        log_error "OPMP服务启动失败"
        docker logs opmp-server 2>&1 | tail -30
        docker logs opmp-client 2>&1 | tail -30
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

# 配置防火墙 (只允许局域网访问)
configure_firewall() {
    log_step "配置防火墙..."

    if command -v ufw &> /dev/null; then
        # 只允许192.168.0.0/16局域网访问
        ufw allow from 192.168.0.0/16 to any port 3000 proto tcp comment 'OPMP LAN' 2>/dev/null || true
        # 也允许10.0.0.0/8私有网段
        ufw allow from 10.0.0.0/8 to any port 3000 proto tcp comment 'OPMP LAN 10.x' 2>/dev/null || true
        # 也允许172.16.0.0/12私有网段
        ufw allow from 172.16.0.0/12 to any port 3000 proto tcp comment 'OPMP LAN 172.x' 2>/dev/null || true
        ufw status | grep -q "active" && ufw reload 2>/dev/null || true
        log_success "防火墙规则已配置 (仅局域网访问)"
    else
        log_info "UFW未安装，跳过防火墙配置"
    fi
}

# 显示安装信息
show_info() {
    SERVER_IP=$(hostname -I | awk '{print $1}')
    [[ -z "$SERVER_IP" ]] && SERVER_IP="localhost"

    # 尝试获取局域网IP
    LAN_IP_DISPLAY=$(ip -4 addr show | grep -oP '192\.168\.\d+\.\d+' | head -1)
    [[ -z "$LAN_IP_DISPLAY" ]] && LAN_IP_DISPLAY=$(ip -4 addr show | grep -oP '(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)' | head -1)
    [[ -z "$LAN_IP_DISPLAY" ]] && LAN_IP_DISPLAY="$SERVER_IP"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║          ✅ OPMP 安装完成!                       ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}📁 安装目录:${NC} $PROJECT_DIR"
    echo -e "${CYAN}📋 配置文件:${NC} $PROJECT_DIR/.env"
    echo ""
    echo -e "${CYAN}🌐 访问地址 (局域网):${NC}"
    echo "   http://${LAN_IP_DISPLAY}:3000"
    echo ""
    echo -e "${CYAN}👤 默认账号:${NC}"
    echo "   admin / opmp@2026 (管理员)"
    echo "   operator / operator@2026"
    echo "   viewer / viewer@2026"
    echo ""
    echo -e "${CYAN}🔧 常用命令:${NC}"
    echo "   查看状态: docker compose ps"
    echo "   查看日志: docker compose logs -f"
    echo "   重启服务: systemctl restart opmp"
    echo "   更新:     sudo bash $PROJECT_DIR/update.sh"
    echo "   卸载:     sudo bash $PROJECT_DIR/uninstall.sh"
    echo ""
    echo -e "${YELLOW}⚠️  生产环境请修改默认密码和JWT_SECRET!${NC}"
    echo -e "${YELLOW}⚠️  默认只允许局域网(192.168.0.0/16)访问${NC}"
    echo ""
}

# 主安装流程
main() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║     OPMP 虚拟数字监控平台 - 一键安装            ║${NC}"
    echo -e "${GREEN}║     适用于 Ubuntu 24.04 LTS                      ║${NC}"
    echo -e "${GREEN}║     GitHub: https://github.com/Jy911125/OPMP     ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    check_root
    update_system
    check_system
    install_dependencies    # 先安装依赖（含git）
    detect_install_mode     # 再检测模式
    install_docker
    install_docker_compose
    prepare_project
    create_directories
    configure_environment
    build_images
    start_services
    create_systemd_service
    configure_firewall
    show_info
}

main "$@"
