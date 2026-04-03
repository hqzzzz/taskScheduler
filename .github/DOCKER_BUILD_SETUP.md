# GitHub Actions Docker 自动构建配置说明

## 工作流说明

此工作流 (`.github/workflows/docker-build.yml`) 会在以下情况下自动构建并推送 Docker 镜像：

- 📤 **push 事件**：提交代码到 `main` 或 `master` 分支
- 🏷️ **tag 事件**：创建 `v*.*.*` 或 `release-*` 格式的标签
- 🔍 **pull request**：提交 PR 到主分支（仅构建，不推送）

## 所需配置

### 1. GitHub Container Registry (GHCR) 配置

GHCR 使用 GitHub 自动提供的 `GITHUB_TOKEN`，**无需额外配置**。

镜像将发布到: `ghcr.io/你的用户名/taskScheduler`

### 2. Docker Hub 配置（可选）

如果需要同时推送到 Docker Hub，请按以下步骤操作：

#### 步骤 1：创建 Docker Hub Token
1. 访问 [Docker Hub 账户设置](https://hub.docker.com/account/security/tokens)
2. 点击 "New Access Token"
3. 设置 token 名称（如：`github-actions`）
4. 选择访问权限（读、写、删除）
5. 复制生成的 token

#### 步骤 2：在 GitHub 仓库中添加 Secrets
1. 进入仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**，添加以下两个 secrets：

| Secret 名称 | 值 |
|-----------|-----|
| `DOCKERHUB_USERNAME` | 你的 Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | 上面生成的 access token |

## 工作流特性

✅ **多注册表支持**：同时推送到 GHCR 和 Docker Hub  
✅ **自动标签管理**：支持 git branch、semver 标签、commit SHA  
✅ **构建缓存**：使用 GitHub Actions 缓存加速构建  
✅ **Pull Request 支持**：PR 中构建但不推送  
✅ **自动 latest 标签**：主分支自动标记为 latest

## 镜像标签

工作流将自动生成以下标签：

### 分支推送 (main)
```
ghcr.io/用户名/taskscheduler:main
ghcr.io/用户名/taskscheduler:latest
你的用户名/taskscheduler:main
你的用户名/taskscheduler:latest
```

### 版本标签 (v1.0.0)
```
ghcr.io/用户名/taskscheduler:v1.0.0
ghcr.io/用户名/taskscheduler:1.0
ghcr.io/用户名/taskscheduler:1
你的用户名/taskscheduler:v1.0.0
你的用户名/taskscheduler:1.0
你的用户名/taskscheduler:1
```

## 使用示例

### 1. 自动构建（仅需要 push 代码）
```bash
git push origin main
```

### 2. 创建版本发布
```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 3. 检查构建状态
进入仓库 → **Actions** 标签页，可查看所有工作流运行情况。

### 4. 拉取镜像

从 GHCR 拉取：
```bash
docker pull ghcr.io/你的用户名/taskscheduler:latest
```

从 Docker Hub 拉取（如果已配置）：
```bash
docker pull 你的用户名/taskscheduler:latest
```

## 故障排除

### 问题 1：Docker Hub 推送失败
- 确认 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` secrets 已正确设置
- 确认 Docker Hub account 有写入权限
- 查看 Actions 日志获取详细错误信息

### 问题 2：构建失败
- 检查 Dockerfile 是否有效
- 查看 GitHub Actions 日志找出错误原因
- 确认 Dockerfile 中的所有依赖都已安装

### 问题 3：镜像未推送
- 检查是否在 PR 中（PR 会构建但不推送）
- 确认事件类型是否在工作流触发条件中（push 到 main/master、tag 创建）

## 修改工作流

如需修改，编辑 `.github/workflows/docker-build.yml` 文件：

- **修改触发分支**：编辑 `on.push.branches`
- **修改镜像名称**：编辑 `Extract metadata` 步骤中的 `images`
- **修改标签格式**：编辑 `tags` 部分的标签模式

## 更多信息

- [Docker Build and Push Action](https://github.com/docker/build-push-action)
- [Docker Metadata Action](https://github.com/docker/metadata-action)
- [GitHub Container Registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
