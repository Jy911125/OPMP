#!/bin/bash

#===============================================================================
# OPMP 虚拟数字监控平台 - 一键卸载脚本
# 适用于 Ubuntu 24.04 LTS
# GitHub: https://github.com/Jy911125/OPMP.git
# 用法: sudo bash uninstall.sh
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
SERVICE_NAME="opmp.service"
GITHUB_REPO="https://github.com/Jy911125/OPMP.git"

# 选项
KEEP_DATA=false
REMOVE_DOCKER=false

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
        log_error "此脚本需要root权限运行，请使用: sudo bash uninstall.sh"
        exit 1
    fi
}

# 确认卸载
confirm_uninstall() {
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                  ║${NC}"
    echo -e "${RED}║     ⚠️  警告: 即将卸载 OPMP                      ║${NC}"
    echo -e "${RED}║                                                  ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "以下内容将被删除:"
    echo "  1. OPMP Docker容器和镜像"
    echo "  2. OPMP项目文件 ($PROJECT_DIR)"
    echo "  3. OPMP Systemd服务"
    echo "  4. OPMP日志、配置和Sudoers规则"
    echo ""
    echo -e "${YELLOW}注意: Docker本身不会被卸载${NC}"
    echo ""

    read -p "确定要继续卸载吗? 输入 'yes' 确认: " -r
    echo

    if [[ "$REPLY" != "yes" ]]; then
        log_info "卸载已取消"
        exit 0
    fi
}

# 询问卸载选项
ask_options() {
    echo ""
    echo -e "${CYAN}── 卸载选项 ──${NC}"
    echo ""

    # 是否保留数据
    read -p "是否保留配置文件和日志数据? (y/n，默认n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        KEEP_DATA=true
        log_info "将保留配置和数据文件"
    else
        KEEP_DATA=false
        log_info "将完全删除所有数据"
    fi

    # 是否删除克隆的仓库源码
    read -p "是否同时删除克隆的Git仓库源码? (y/n，默认n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        REMOVE_SOURCE=true
        log_info "将删除Git仓库源码"
    else
        REMOVE_SOURCE=false
        log_info "将保留Git仓库源码"
    fi

    echo ""
}

# 停止Systemd服务
stop_systemd_service() {
    log_step "停止系统服务..."

    if systemctl is-active --quiet opmp.service 2>/dev/null; then
        systemctl stop opmp.service
        log_success "OPMP系统服务已停止"
    else
        log_info "OPMP系统服务未运行"
    fi
}

# 停止Docker容器
stop_docker_containers() {
    log_step "停止Docker容器..."

    if [[ -d "$PROJECT_DIR" && -f "$PROJECT_DIR/docker-compose.yml" ]]; then
        cd "$PROJECT_DIR"

        if docker compose version &> /dev/null; then
            docker compose down --remove-orphans 2>/dev/null || true
        else
            docker-compose down --remove-orphans 2>/dev/null || true
        fi
        log_success "Docker容器已停止"
    else
        log_info "未找到docker-compose.yml，尝试直接停止容器..."

        CONTAINERS=$(docker ps -a --filter "name=opmp" -q 2>/dev/null)
        if [[ -n "$CONTAINERS" ]]; then
            docker stop $CONTAINERS 2>/dev/null || true
            docker rm $CONTAINERS 2>/dev/null || true
            log_success "OPMP容器已停止并删除"
        else
            log_info "未找到运行中的OPMP容器"
        fi
    fi
}

# 删除Docker镜像
remove_docker_images() {
    log_step "删除Docker镜像..."

    # 删除opmp相关镜像
    IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -i "opmp" 2>/dev/null || true)
    if [[ -n "$IMAGES" ]]; then
        echo "$IMAGES" | while read -r image; do
            docker rmi -f "$image" 2>/dev/null || true
        done
        log_success "OPMP Docker镜像已删除"
    else
        # 也检查无tag的镜像
        DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null || true)
        if [[ -n "$DANGLING" ]]; then
            docker rmi $DANGLING 2>/dev/null || true
        fi
        log_info "未找到OPMP镜像"
    fi

    # 清理构建缓存
    log_info "清理Docker构建缓存..."
    docker builder prune -f 2>/dev/null || true
}

# 删除Docker网络和卷
remove_docker_resources() {
    log_step "清理Docker资源..."

    # 删除OPMP网络
    NETWORKS=$(docker network ls --filter "name=opmp" -q 2>/dev/null || true)
    if [[ -n "$NETWORKS" ]]; then
        echo "$NETWORKS" | while read -r net; do
            docker network rm "$net" 2>/dev/null || true
        done
        log_success "Docker网络已删除"
    fi

    # 删除OPMP卷
    VOLUMES=$(docker volume ls --filter "name=opmp" -q 2>/dev/null || true)
    if [[ -n "$VOLUMES" ]]; then
        echo "$VOLUMES" | while read -r vol; do
            docker volume rm "$vol" 2>/dev/null || true
        done
        log_success "Docker卷已删除"
    fi

    # 删除node-modules缓存卷
    if docker volume ls -q | grep -q "node-modules-cache"; then
        docker volume rm node-modules-cache 2>/dev/null || true
        log_success "Node模块缓存卷已删除"
    fi
}

# 删除Systemd服务文件
remove_systemd_service() {
    log_step "删除系统服务..."

    if [[ -f "/etc/systemd/system/$SERVICE_NAME" ]]; then
        systemctl disable opmp.service 2>/dev/null || true
        rm -f "/etc/systemd/system/$SERVICE_NAME"
        systemctl daemon-reload
        log_success "Systemd服务已删除"
    else
        log_info "未找到Systemd服务文件"
    fi
}

# 删除Sudoers配置
remove_sudoers() {
    log_step "删除Sudoers配置..."

    if [[ -f "/etc/sudoers.d/opmp" ]]; then
        rm -f "/etc/sudoers.d/opmp"
        log_success "Sudoers配置已删除"
    else
        log_info "未找到Sudoers配置"
    fi
}

# 删除防火墙规则
remove_firewall_rules() {
    log_step "删除防火墙规则..."

    if command -v ufw &> /dev/null; then
        # 通过规则编号删除
        ufw delete allow 8080/tcp 2>/dev/null || true
        ufw delete allow 3000/tcp 2>/dev/null || true

        if ufw status | grep -q "active"; then
            ufw reload 2>/dev/null || true
        fi
        log_success "防火墙规则已删除"
    else
        log_info "UFW未安装，跳过"
    fi
}

# 删除项目文件
remove_project_files() {
    log_step "删除项目文件..."

    if [[ ! -d "$PROJECT_DIR" ]]; then
        log_info "未找到项目目录: $PROJECT_DIR"
        return
    fi

    if [[ "$KEEP_DATA" == true ]]; then
        # 保留数据，只删除程序文件
        log_info "保留配置和数据，仅删除程序文件..."
        rm -rf "$PROJECT_DIR/server"
        rm -rf "$PROJECT_DIR/client"
        rm -f "$PROJECT_DIR/docker-compose.yml"
        rm -f "$PROJECT_DIR/install.sh"
        rm -f "$PROJECT_DIR/uninstall.sh"
        # 保留: .env, logs/, data/, *.md
        log_success "程序文件已删除（配置和数据已保留）"
    else
        # 完全删除
        rm -rf "$PROJECT_DIR"
        log_success "项目目录已完全删除: $PROJECT_DIR"
    fi
}

# 删除日志目录
remove_logs() {
    if [[ "$KEEP_DATA" == true ]]; then
        log_info "保留日志目录..."
        return
    fi

    log_step "删除日志目录..."

    if [[ -d "/var/log/opmp" ]]; then
        rm -rf "/var/log/opmp"
        log_success "日志目录已删除"
    else
        log_info "未找到日志目录"
    fi
}

# 删除克隆的源码仓库
remove_source_repo() {
    if [[ "$REMOVE_SOURCE" != true ]]; then
        return
    fi

    log_step "检查Git仓库源码..."

    # 查找可能的克隆目录
    LOCAL_REPO=""

    # 检查常见位置
    for dir in \
        "$HOME/OPMP" \
        "$HOME/UniverseOPMP" \
        "/root/OPMP" \
        "/root/UniverseOPMP"; do
        if [[ -d "$dir/.git" ]]; then
            LOCAL_REPO="$dir"
            break
        fi
    done

    if [[ -n "$LOCAL_REPO" ]]; then
        log_info "发现克隆仓库: $LOCAL_REPO"
        read -p "确认删除此目录? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$LOCAL_REPO"
            log_success "Git仓库已删除: $LOCAL_REPO"
        fi
    else
        log_info "未找到克隆的Git仓库目录"
    fi
}

# 清理临时文件
cleanup_temp() {
    log_step "清理临时文件..."
    rm -rf /tmp/opmp-* 2>/dev/null || true
    log_success "临时文件已清理"
}

# 显示完成信息
show_complete() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}║     ✅ OPMP 卸载完成!                            ║${NC}"
    echo -e "${GREEN}║                                                  ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    if [[ "$KEEP_DATA" == true ]]; then
        echo -e "${CYAN}📁 保留的数据:${NC}"
        echo "   配置文件: $PROJECT_DIR/.env"
        echo "   日志目录: $PROJECT_DIR/logs"
        echo "   数据目录: $PROJECT_DIR/data"
        echo ""
        echo "   如需完全删除，请执行:"
        echo "   rm -rf $PROJECT_DIR"
        echo "   rm -rf /var/log/opmp"
        echo ""
    fi

    echo -e "${CYAN}📝 说明:${NC}"
    echo "   - Docker服务仍然保留"
    echo "   - OPMP相关容器、镜像、网络、卷已删除"
    echo "   - 如需重新安装: git clone $GITHUB_REPO && cd OPMP && sudo bash install.sh"
    echo ""
    echo -e "${GREEN}===================================================${NC}"
    echo ""
}

# 主卸载流程
main() {
    echo ""
    echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                  ║${NC}"
    echo -e "${RED}║     OPMP 虚拟数字监控平台 - 卸载程序            ║${NC}"
    echo -e "${RED}║                                                  ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    # 执行卸载步骤
    check_root
    confirm_uninstall
    ask_options
    stop_systemd_service
    stop_docker_containers
    remove_docker_images
    remove_docker_resources
    remove_systemd_service
    remove_sudoers
    remove_firewall_rules
    remove_project_files
    remove_logs
    remove_source_repo
    cleanup_temp
    show_complete
}

# 运行主程序
main "$@"
