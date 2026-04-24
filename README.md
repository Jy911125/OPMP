# OPMP 虚拟数字监控平台

**O**mnipotent **P**latform **M**onitor & **M**anagement

> 基于 Node.js + Vue 3 + Three.js 的 Linux 系统与 Docker 容器一体化监控管理平台

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Ubuntu%2024.04-orange)

---

## 功能特性

### 系统管理
- **实时监控** - CPU、内存、磁盘、网络实时监控与历史图表
- **文件管理** - 可视化文件浏览、编辑、上传、权限管理
- **进程管理** - 进程列表、详情、终止操作
- **用户管理** - 用户/组CRUD操作
- **网络管理** - 接口、连接、防火墙可视化配置
- **服务管理** - Systemd服务启停、状态查看
- **软件包管理** - APT包安装、卸载、更新
- **定时任务** - Crontab可视化管理
- **系统日志** - Journalctl日志查看与搜索

### Docker管理
- **容器管理** - 创建、启停、日志、终端、删除
- **镜像管理** - 列表、拉取、删除、详情
- **卷管理** - 数据卷CRUD、清理
- **网络管理** - Docker网络配置
- **Compose** - YAML编辑与部署

### 3D可视化
- **服务器机柜** - 3D服务器状态展示
- **容器群** - 容器状态3D可视化
- **网络拓扑** - 网络连接3D展示

---

## 系统要求

| 项目 | 要求 |
|------|------|
| 操作系统 | Ubuntu 24.04 LTS |
| 权限 | root (sudo) |
| 内存 | >= 2GB |
| 磁盘 | >= 10GB 可用空间 |
| 网络 | 需要访问互联网 (拉取Docker镜像) |

---

## 安装

### 方式一：一键安装（推荐）

无需预装任何软件，一行命令搞定：

```bash
curl -fsSL https://raw.githubusercontent.com/Jy911125/OPMP/main/install.sh | sudo bash
```

脚本会自动完成所有操作：
- 安装 git、curl 等基础依赖
- 安装 Docker & Docker Compose
- 从 GitHub 克隆项目
- 构建Docker镜像（前端+后端一体化）
- 生成JWT密钥、配置环境变量
- 自动检测局域网IP并绑定
- 启动服务 & 创建开机自启
- 配置防火墙（仅允许局域网访问）

### 方式二：克隆后安装

```bash
git clone https://github.com/Jy911125/OPMP.git
cd OPMP && sudo bash install.sh
```

### 安装完成后访问

- **Web界面 + API**: http://局域网IP:3000
- 默认只允许局域网 (192.168.0.0/16) 访问
- 如需开放外网，请自行配置反向代理和防火墙

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | opmp@2026 |
| 操作员 | operator | operator@2026 |
| 观察员 | viewer | viewer@2026 |

**生产环境请务必修改默认密码和JWT密钥！**

JWT密钥位于: `/opt/opmp/.env` 中的 `JWT_SECRET` 字段

---

## 常用运维命令

```bash
# 查看服务状态
cd /opt/opmp && docker compose ps

# 查看实时日志
cd /opt/opmp && docker compose logs -f

# 重启服务
systemctl restart opmp

# 停止服务
systemctl stop opmp

# 启动服务
systemctl start opmp

# 重新构建并启动（代码更新后）
cd /opt/opmp && docker compose up -d --build
```

---

## 卸载

```bash
# 一键卸载（会交互式询问是否保留数据）
sudo bash /opt/opmp/uninstall.sh

# 或者在项目源码目录下
cd OPMP && sudo bash uninstall.sh
```

卸载脚本会：
- 停止并删除所有OPMP容器
- 删除OPMP Docker镜像
- 清理Docker网络和卷
- 删除Systemd服务
- 可选保留或删除配置数据和日志
- **不会卸载Docker本身**

---

## 项目结构

```
OPMP/
├── install.sh                 # 一键安装脚本
├── uninstall.sh               # 一键卸载脚本
├── update.sh                  # 一键更新脚本
├── docker-compose.yml         # Docker编排配置
├── server/                    # 后端 (Node.js + Express + TypeScript)
│   ├── Dockerfile             # 多阶段构建 (前端+后端一体化)
│   ├── .env                   # 环境变量
│   └── src/
│       ├── app.ts             # 应用入口 (API + 静态文件托管)
│       ├── config/            # 配置 & 命令白名单
│       ├── routes/            # API路由
│       ├── services/          # 业务逻辑
│       ├── middleware/        # 认证/审计/限流
│       ├── types/             # TypeScript类型定义
│       ├── utils/             # 命令执行器/输出解析器
│       └── websocket/         # WebSocket实时推送
├── client/                    # 前端 (Vue 3 + Vite + TypeScript)
│   └── src/
│       ├── views/             # 页面组件
│       │   ├── system/        #   系统管理页面 (9个)
│       │   └── docker/        #   Docker管理页面 (6个)
│       ├── stores/            # Pinia状态管理
│       ├── api/               # Axios API封装
│       ├── router/            # Vue Router路由
│       └── assets/            # 样式资源
├── CONTRIBUTING.md            # 贡献指南
└── README.md                  # 项目说明
```

---

## 安全说明

1. **命令白名单** - 所有系统命令通过预定义白名单校验，防止命令注入
2. **JWT认证** - 基于JWT的用户认证，支持Token刷新
3. **RBAC权限** - admin/operator/viewer三级权限控制
4. **审计日志** - 所有写操作记录审计日志
5. **限流保护** - API级别限流，防止暴力攻击
6. **局域网绑定** - 默认只允许局域网(192.168.0.0/16)访问

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Element Plus + ECharts |
| 3D可视化 | Three.js + OrbitControls |
| 后端 | Node.js + Express + TypeScript |
| 实时通信 | Socket.IO (WebSocket) |
| Docker API | Dockerode |
| 容器化 | Docker + Docker Compose |
| 基础镜像 | node:24-alpine |

---

## 许可证

MIT License
