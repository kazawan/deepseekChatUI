#!/bin/bash

# 询问用户配置 .env 文件
if [ ! -f .env ]; then
    echo "创建 .env 文件..."
    touch .env

    # 逐行读取 .env.example 文件并提示用户输入值
    if [ -f .env.example ]; then
        mapfile -t lines < .env.example
        for line in "${lines[@]}"; do
            if [[ $line == *=* ]]; then
                varname=$(echo "$line" | cut -d '=' -f 1)
                echo -n "请输入 $varname 的值: "
                read varvalue
                echo "$varname=$varvalue" >> .env
            fi
        done
    fi

    echo ".env 文件已创建，请根据需要修改配置。"
fi

# 构建并启动 Docker Compose
echo "构建并启动 Docker Compose..."
docker-compose build
docker-compose up -d

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

echo "服务已启动。"