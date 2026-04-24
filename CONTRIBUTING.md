# 贡献指南

## 分支策略

```
main        # 主分支，稳定发布版本
  ↑
develop     # 开发分支，功能集成
  ↑
feature/*   # 功能分支
fix/*       # 修复分支
```

## 工作流程

### 1. 功能开发

```bash
# 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# 开发完成后推送到远程
git push -u origin feature/your-feature-name

# 在 GitHub 创建 Pull Request → develop
```

### 2. Bug 修复

```bash
git checkout develop
git checkout -b fix/bug-description
# 修复后创建 PR → develop
```

### 3. 版本发布

当 develop 分支功能稳定后：
```bash
# 创建 PR: develop → main
# 合并后打 tag
git checkout main
git tag -a v1.x.x -m "版本说明"
git push origin v1.x.x
```

## 提交规范

```
feat:     新功能
fix:      Bug修复
docs:     文档更新
style:    代码格式
refactor: 重构
perf:     性能优化
test:     测试
chore:    构建/工具
```

## 版本号规则

- **主版本号**: 重大架构变更
- **次版本号**: 新功能添加
- **修订号**: Bug修复

示例: `v1.2.3`
- 1: 主版本
- 2: 次版本
- 3: 修订号

## 当前版本

最新稳定版本: `v1.0.0`

开发版本见 develop 分支。
