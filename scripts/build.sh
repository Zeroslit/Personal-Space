#!/usr/bin/env bash
# 一键构建：构建前端 → 复制进后端资源目录 → 打成单个可执行 jar
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if ! command -v node >/dev/null 2>&1; then
  echo "缺少依赖：node（请安装 Node.js 20+）" >&2
  exit 1
fi
if ! command -v java >/dev/null 2>&1; then
  echo "缺少依赖：java（请安装 JDK 17 或更高）" >&2
  exit 1
fi
echo "→ java: $(java -version 2>&1 | head -n 1)"

echo "→ 构建前端（web/）"
cd "$root/web"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build

echo "→ 复制前端产物到 server/src/main/resources/static"
target="$root/server/src/main/resources/static"
rm -rf "$target"
mkdir -p "$target"
cp -R "$root/web/dist/." "$target/"

echo "→ 打包后端（server/）"
cd "$root/server"
if [ -f ./mvnw ]; then
  chmod +x ./mvnw || true
  ./mvnw -q clean package
elif command -v mvn >/dev/null 2>&1; then
  mvn -q clean package
else
  echo "找不到 mvnw 或 mvn，无法打包后端" >&2
  exit 1
fi

jar="$root/server/target/personal-space.jar"
echo
echo "构建完成：$jar"
echo "启动：java -jar server/target/personal-space.jar"
