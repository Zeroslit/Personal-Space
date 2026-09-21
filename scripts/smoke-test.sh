#!/usr/bin/env bash
# curl 端到端自测：覆盖全部 REST 端点、「GitHub 地址必填」规则与 GitHub 代取接口
# 用法：BASE_URL=http://127.0.0.1:8787 ./scripts/smoke-test.sh
set -uo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"
pass=0
fail=0
STATUS=""
BODY=""

if ! command -v curl >/dev/null 2>&1; then
  echo "缺少依赖：curl" >&2
  exit 1
fi

green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }
yellow() { printf '\033[33m%s\033[0m' "$1"; }

request() {
  local method="$1" path="$2" data="${3:-}" tmp
  tmp="$(mktemp)"
  if [ -n "$data" ]; then
    STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' --data-binary "$data" "$BASE_URL$path")"
  else
    STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X "$method" "$BASE_URL$path")"
  fi
  BODY="$(cat "$tmp")"
  rm -f "$tmp"
}

status_of() { curl -sS -o /dev/null -w '%{http_code}' -X "$1" "$BASE_URL$2"; }

expect() {
  if [ "$STATUS" = "$1" ]; then
    pass=$((pass + 1))
    printf '  %s %s (%s)\n' "$(green PASS)" "$2" "$STATUS"
  else
    fail=$((fail + 1))
    printf '  %s %s：期望 %s，实际 %s\n         %s\n' "$(red FAIL)" "$2" "$1" "$STATUS" "$BODY"
  fi
}

expect_body() {
  if printf '%s' "$BODY" | grep -q -- "$1"; then
    pass=$((pass + 1))
    printf '  %s %s\n' "$(green PASS)" "$2"
  else
    fail=$((fail + 1))
    printf '  %s %s：响应缺少 %s\n         %s\n' "$(red FAIL)" "$2" "$1" "$BODY"
  fi
}

skip() { printf '  %s %s\n' "$(yellow SKIP)" "$1"; }

# 响应形如 {"id":"p_xxx",...}，必须取第一个 id，否则带 snippets 的项目会取到片段 id
id_of() { printf '%s' "$BODY" | sed -n 's/^{"id":"\([^"]*\)".*/\1/p' | head -n 1; }

echo "目标服务：$BASE_URL"

echo
echo "[1] 健康检查与列表"
request GET /api/health
expect 200 'GET /api/health'
expect_body '"status":"ok"' '健康检查返回 status=ok'
request GET /api/projects
expect 200 'GET /api/projects'
expect_body '"items"' '列表返回 items'
request GET '/api/projects?q=react&pinned=true'
expect 200 'GET /api/projects?q=&pinned='

echo
echo "[2] 链接规则：GitHub 仓库地址必填"
request POST /api/projects '{"title":"smoke 没有 GitHub 地址"}'
expect 400 '没填 repoUrl → 400'
expect_body 'validation_error' '400 返回统一错误结构 {error, message}'
expect_body 'repoUrl' '错误信息点名 repoUrl'
request POST /api/projects '{"title":"smoke 只有演示网址","siteUrl":"https://example.com/demo"}'
expect 400 '只填 siteUrl 不填 repoUrl → 400'
request POST /api/projects '{"title":"smoke 非法协议","repoUrl":"ftp://example.com"}'
expect 400 '非 http(s) 协议 → 400'
request POST /api/projects '{"title":"   ","repoUrl":"https://example.com"}'
expect 400 '空标题 → 400'

echo
echo "[3] GitHub 仓库解析（粘贴地址自动填充简介的后端）"
request GET '/api/github/repo'
expect 400 '缺少 url 参数 → 400'
request GET '/api/github/repo?url=https%3A%2F%2Fgitlab.com%2Fa%2Fb'
expect 400 '非 github.com 地址 → 400'
tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w '%{http_code}' "$BASE_URL/api/github/repo?url=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai-python")"
remote="$(cat "$tmp")"
rm -f "$tmp"
case "$code" in
  200)
    pass=$((pass + 1))
    printf '  %s GET /api/github/repo?url=github.com/openai/openai-python（联网可用）\n' "$(green PASS)"
    if printf '%s' "$remote" | grep -q '"summarySuggestion"'; then
      pass=$((pass + 1))
      printf '  %s 返回里带 summarySuggestion\n' "$(green PASS)"
    else
      fail=$((fail + 1))
      printf '  %s 返回里没有 summarySuggestion：%s\n' "$(red FAIL)" "$remote"
    fi
    ;;
  429 | 502 | 504)
    skip "真实抓取跳过：本机访问不到 GitHub（HTTP $code）"
    ;;
  *)
    fail=$((fail + 1))
    printf '  %s 真实抓取返回了意外状态 %s：%s\n' "$(red FAIL)" "$code" "$remote"
    ;;
esac

echo
echo "[4] 建立测试项目"
request POST /api/projects '{"title":"smoke 只有仓库","repoUrl":"https://github.com/example/smoke-a","tags":["smoke"],"language":"TypeScript","status":"active","stars":3}'
expect 201 '只填 repoUrl → 201'
id_repo="$(id_of)"
request POST /api/projects '{"title":"smoke 两个都填","repoUrl":"https://github.com/example/smoke-b","siteUrl":"https://example.com/b","tags":["smoke"],"snippets":[{"filename":"a.ts","language":"typescript","code":"export const a = 1;\n"}]}'
expect 201 '两个都填 → 201'
id_both="$(id_of)"
request POST /api/projects '{"title":"smoke 演示需要登录","repoUrl":"https://github.com/example/smoke-c","siteUrl":"https://accounts.google.com/signin","demoLogin":true,"tags":["smoke"]}'
expect 201 '演示标记为需要登录 → 201'
id_login="$(id_of)"
expect_body '"demoLogin":true' 'demoLogin 已保存'

if [ -z "$id_repo" ] || [ -z "$id_both" ] || [ -z "$id_login" ]; then
  printf '%s 无法从响应中解析新建项目 id，后续用例中止\n' "$(red FAIL)"
  exit 1
fi

echo
echo "[5] 详情 / 更新 / 排序 / 标签 / 设置"
request GET "/api/projects/$id_login"
expect 200 'GET /api/projects/:id'
request GET "/api/projects/$id_both"
expect 200 'GET /api/projects/:id（带片段）'
expect_body '"snippets"' '详情包含代码片段'
request PUT "/api/projects/$id_repo" '{"title":"smoke 只有仓库（改了标题和演示）","repoUrl":"https://github.com/example/smoke-a","siteUrl":"https://example.com/renamed"}'
expect 200 'PUT 更新链接'
request PUT "/api/projects/$id_repo" '{"title":"smoke 清空 repoUrl","siteUrl":"https://example.com/renamed"}'
expect 400 'PUT 清空 repoUrl → 400'
request PUT "/api/projects/$id_both" '{"title":"smoke 清空所有链接"}'
expect 400 'PUT 清空所有链接 → 400'
request PATCH /api/projects/order "{\"ids\":[\"$id_login\",\"$id_both\",\"$id_repo\"]}"
expect 200 'PATCH /api/projects/order'
expect_body '"items"' '排序返回排序后的列表'
request GET /api/tags
expect 200 'GET /api/tags'
request GET /api/settings
expect 200 'GET /api/settings'
request PUT /api/settings '{"theme":"midnight"}'
expect 200 'PUT /api/settings 切换主题'
request PUT /api/settings '{"theme":"not-a-theme"}'
expect 400 '非法主题 → 400'
request PUT /api/settings '{"accent":"#7c5cff"}'
expect 200 'PUT /api/settings 自定义主色'
request PUT /api/settings '{"accent":"红色"}'
expect 400 '非法主色 → 400'

echo
echo "[6] 封面图上传"
if command -v base64 >/dev/null 2>&1; then
  png="$(mktemp).png"
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/8iH4AAAAAElFTkSuQmCC' | base64 -d > "$png" 2>/dev/null || true
  if [ -s "$png" ]; then
    tmp="$(mktemp)"
    STATUS="$(curl -sS -o "$tmp" -w '%{http_code}' -X POST -H 'Content-Type: image/png' --data-binary "@$png" "$BASE_URL/api/assets")"
    BODY="$(cat "$tmp")"
    rm -f "$tmp"
    expect 201 'POST /api/assets 上传 PNG'
    asset_url="$(printf '%s' "$BODY" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p' | head -n 1)"
    if [ -n "$asset_url" ]; then
      code="$(status_of GET "$asset_url")"
      if [ "$code" = "200" ]; then
        pass=$((pass + 1)); printf '  %s GET %s 读取已上传封面\n' "$(green PASS)" "$asset_url"
      else
        fail=$((fail + 1)); printf '  %s 读取已上传封面：期望 200，实际 %s\n' "$(red FAIL)" "$code"
      fi
    fi
    code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: text/plain' --data-binary 'x' "$BASE_URL/api/assets")"
    if [ "$code" = "415" ]; then
      pass=$((pass + 1)); printf '  %s 非图片类型 → 415\n' "$(green PASS)"
    else
      fail=$((fail + 1)); printf '  %s 非图片类型：期望 415，实际 %s\n' "$(red FAIL)" "$code"
    fi
    rm -f "$png"
  else
    skip '跳过：本机 base64 无法生成测试 PNG'
  fi
else
  skip '跳过：未找到 base64'
fi

echo
echo "[7] 错误处理与 SPA 兜底"
request GET /api/projects/p_not_exists_at_all
expect 404 '不存在的项目 → 404'
request POST /api/health
expect 405 '错误方法 → 405'
request GET /p/anything
expect 200 'SPA 兜底 /p/anything'
expect_body 'id="root"' '返回前端页面'

echo
echo "[8] 清理测试数据"
for id in "$id_repo" "$id_both" "$id_login"; do
  request DELETE "/api/projects/$id"
  expect 200 "DELETE /api/projects/$id"
done
request GET "/api/projects/$id_both"
expect 404 '删除后读取 → 404'

echo
printf '结果：%s 通过，%s 失败\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
