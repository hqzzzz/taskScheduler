# 快速开始 - 5分钟内启用自动 Docker 构建

## 最快启动方式（推荐仅用 GitHub Container Registry）

工作流文件已创建在 `.github/workflows/docker-build.yml`

**无需任何配置即可开始使用！** 直接 push 代码即可自动构建。

```bash
git add .
git commit -m "Add GitHub Actions Docker build workflow"
git push origin main
```

## 可选：配置 Docker Hub 同时推送

如果还想推送到 Docker Hub，只需 2 个秘密：

### 获取 Docker Hub Access Token
1. 登录 [hub.docker.com](https://hub.docker.com)
2. 账户设置 → Security → New Access Token
3. 创建 token（选择读写权限）

### 在 GitHub 中添加 Secrets
```
仓库设置 → Secrets and variables → Actions
添加两个 secrets：
  - DOCKERHUB_USERNAME: 你的Docker用户名
  - DOCKERHUB_TOKEN: 上面复制的token
```

完成！现在 push 代码时会同时推送到两个仓库。

## 查看构建结果

1. 进入 GitHub 仓库 → Actions 标签
2. 实时查看构建进度
3. 构建完成后可以拉取镜像：

```bash
# GitHub Container Registry
docker pull ghcr.io/用户名/taskscheduler:latest

# Docker Hub（如果配置了）
docker pull 用户名/taskscheduler:latest
```

## 创建版本标签并发布

```bash
git tag v1.0.0
git push origin v1.0.0
```

就这样！工作流会自动构建并标记为 `v1.0.0`、`1.0`、`1` 和 `latest`。

## 文件清单

✅ `.github/workflows/docker-build.yml` - 工作流配置文件  
✅ `.github/DOCKER_BUILD_SETUP.md` - 详细配置说明  
✅ `Dockerfile` - Docker 镜像定义（已有）  

一切就绪！🚀
