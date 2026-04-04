# 第一阶段：构建前端
FROM node:22-slim AS builder

WORKDIR /app

# 复制依赖配置
COPY package*.json ./

# 安装所有依赖（包括 devDependencies 用于构建）
RUN npm install

# 复制所有源代码
COPY . .

# 构建前端静态资源
RUN npm run build

# 第二阶段：运行环境
FROM node:22-slim

WORKDIR /app

# 安装 Python 和常用系统工具 (df, free, ps 等)
RUN apt-get update && apt-get install -y \
    python3 \
    procps \
    locales \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen \
    && rm -rf /var/lib/apt/lists/*

# 设置全局环境变量
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# 仅安装生产环境依赖
COPY package*.json ./
RUN npm install --omit=dev

# 从构建阶段复制构建产物和后端代码
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./

# 创建数据目录并初始化必要的文件
RUN mkdir -p /data && \
    if [ ! -f /data/tasks.json ]; then echo "[]" > /data/tasks.json; fi && \
    if [ ! -f /data/logs.json ]; then echo "[]" > /data/logs.json; fi

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV APP_USERNAME=admin
ENV APP_PASSWORD=admin
ENV DATA_DIR=/data

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "--experimental-strip-types", "server.ts"]
