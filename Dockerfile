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
# 确保 tasks.json 存在，如果不存在则创建一个空的
RUN if [ ! -f tasks.json ]; then echo "[]" > tasks.json; fi

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 启动命令 (Node 22 支持原生运行 .ts 文件)
CMD ["node", "--experimental-strip-types", "server.ts"]
