#!/bin/bash

#===============================================================================
# OPMP 虚拟数字监控平台 - 一键更新脚本
# 适用于 Ubuntu 24.04 LTS
# GitHub: https://github.com/Jy911125/OPMP.git
#
# 用法:
#   sudo bash update.sh [版本号]
#   sudo bash update.sh          # 更新到最新版本
#   sudo bash update.sh v1.0.0   # 更新到指定版本
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
BACKUP_DIR="/opt/opmp-backup"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 检查root权限
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        exit 1
    fi
}

# 检查是否已安装
check_installation() {
    if [[ ! -d "$PROJECT_DIR" ]]; then
        log_error "OPMP未安装，请先运行 install.sh"
        exit 1
    fi

    if [[ ! -f "$PROJECT_DIR/docker-compose.yml" ]]; then
        log_error "安装目录不完整"
        exit 1
    fi
}

# 获取当前版本
get_current_version() {
    CURRENT_VERSION=$(cd "$PROJECT_DIR" 2>/dev/null && git describe --tags 2>/dev/null || echo "unknown")
    log_info "当前版本: $CURRENT_VERSION"
}

# 获取最新版本
get_latest_version() {
    log_info "获取最新版本信息..."

    LATEST_VERSION=$(curl -s "https://api.github.com/repos/Jy911125/OPMP/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

    if [[ -z "$LATEST_VERSION" ]]; then
        # 如果没有release，获取最新commit
        LATEST_VERSION=$(git ls-remote --tags --sort=-v:refname "$GITHUB_REPO" 2>/dev/null | head -1 | awk -F'/' '{print $NF}')
    fi

    if [[ -z "$LATEST_VERSION" ]]; then
        LATEST_VERSION="main"
    fi

    log_info "最新版本: $LATEST_VERSION"
}

# 备份配置
backup_config() {
    log_step "备份配置文件..."

    BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}_${BACKUP_TIME}"

    mkdir -p "$BACKUP_PATH"

    # 备份.env配置
    if [[ -f "$PROJECT_DIR/.env" ]]; then
        cp "$PROJECT_DIR/.env" "$BACKUP_PATH/.env"
        log_info "已备份 .env"
    fi

    # 备份数据目录
    if [[ -d "$PROJECT_DIR/data" ]]; then
        cp -r "$PROJECT_DIR/data" "$BACKUP_PATH/"
        log_info "已备份 data/"
    fi

    log_success "配置已备份到: $BACKUP_PATH"
}

# 停止服务
stop_services() {
    log_step "停止OPMP服务..."

    cd "$PROJECT_DIR"

    if docker compose version &> /dev/null; then
        docker compose down 2>/dev/null || true
    else
        docker-compose down 2>/dev/null || true
    fi

    log_success "服务已停止"
}

# 拉取最新代码
pull_latest() {
    log_step "更新代码..."

    local target_version="${1:-}"

    cd "$PROJECT_DIR"

    # 保存当前配置
    if [[ -f ".env" ]]; then
        cp ".env" "/tmp/opmp-env-backup"
    fi

    # 获取最新代码
    git fetch --all --tags 2>/dev/null || {
        log_warning "git fetch失败，尝试重新克隆..."
        rm -rf "$PROJECT_DIR"
        git clone "$GITHUB_REPO" "$PROJECT_DIR"
    }

    # 切换到指定版本
    if [[ -n "$target_version" ]]; then
        git checkout "$target_version" 2>/dev/null || {
            log_error "版本 $target_version 不存在"
            exit 1
        }
    else
        git checkout main
        git pull origin main 2>/dev/null || true
        # 尝试切换到最新tag
        LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
        if [[ -n "$LATEST_TAG" ]]; then
            git checkout "$LATEST_TAG" 2>/dev/null || true
            log_info "已切换到版本: $LATEST_TAG"
        fi
    fi

    # 恢复配置
    if [[ -f "/tmp/opmp-env-backup" ]]; then
        cp "/tmp/opmp-env-backup" ".env"
        rm "/tmp/opmp-env-backup"
    fi

    # 显示更新日志
    echo ""
    log_info "更新内容:"
    git log --oneline -5 2>/dev/null || true
    echo ""

    log_success "代码更新完成"
}

# 重新构建镜像
rebuild_images() {
    log_step "重新构建Docker镜像..."

    cd "$PROJECT_DIR"

    if docker compose version &> /dev/null; then
        docker compose build --no-cache
    else
        docker-compose build --no-cache
    fi

    log_success "镜像构建完成"
}

# 启动服务
start_services() {
    log_step "启动服务..."

    cd "$PROJECT_DIR"

    if docker compose version &> /dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi

    log_info "等待服务启动..."
    sleep 10

    if docker ps | grep -q "opmp"; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        docker logs opmp-server 2>&1 | tail -20
        exit 1
    fi
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份..."

    # 保留最近5个备份
    ls -dt "${BACKUP_DIR}_"* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
}

# 显示完成信息
show_info() {
    NEW_VERSION=$(cd "$PROJECT_DIR" && git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    SERVER_IP=$(hostname -I | awk '{print $1}')
    [[ -z "$SERVER_IP" ]] && SERVER_IP="localhost"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║          ✅ OPMP 更新完成!                       ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}版本:${NC} $NEW_VERSION"
    echo ""
    echo -e "${CYAN}访问地址:${NC} http://${SERVER_IP}:8080"
    echo ""
}

# 主流程
main() {
    TARGET_VERSION="${1:-}"

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     OPMP 虚拟数字监控平台 - 更新程序            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    check_root
    check_installation
    get_current_version

    if [[ -z "$TARGET_VERSION" ]]; then
        get_latest_version
    fi

    backup_config
    stop_services
    pull_latest "$TARGET_VERSION"
    rebuild_images
    start_services
    cleanup_old_backups
    show_info
}

main "$@"
