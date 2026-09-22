# 个人空间（Personal Space）

> [English README](README.en.md) · 中文版

单用户的个人项目展示站：把自己的项目集中在一页里，每个项目包含**简介、链接（GitHub 仓库 / 演示网址）、代码片段、内嵌实况演示**。目标是在观感与交互上比 GitHub 更简洁、更顺手：乐观更新、删除 5 秒内可撤销、拖拽排序、命令面板、6 套主题与自定义主色。

后端 Java 17（JDK 内置 HTTP 服务器）+ Gson + sqlite-jdbc，Maven 打成**单个可执行 jar**，同一个进程同时提供 REST API 与内嵌前端页面；前端 React 18 + TypeScript + Vite + Tailwind。全程**不依赖任何在线 CDN**，也不使用 Electron / Tauri / YAML / Redux。

## 目录结构

```
personal-space/
├── server/                        # Java 17 后端（产出单个 jar）
│   ├── pom.xml
│   ├── mvnw / mvnw.cmd            # Maven Wrapper，不需要预装 Maven
│   └── src/main/java/app/pspace/
│       ├── Main.java              # 启动、参数解析、优雅关闭
│       ├── Options.java           # 命令行参数与环境变量
│       ├── Db.java                # SQLite 连接与建表迁移
│       ├── Store.java             # 项目 / 片段 / 标签 / 设置 / 资产的读写
│       ├── Seed.java              # 首次启动导入 seed/projects.json
│       ├── Validate.java          # 入参校验，不合法即 400
│       ├── ApiException.java      # 统一错误结构 {error, message}
│       ├── Json.java / Version.java
│       ├── GitHub.java            # 读取 GitHub 仓库信息（自动填充简介）
│       ├── model/                 # Project / Snippet / Settings / Asset ...
│       └── web/                   # Router / Http / StaticFiles
├── web/                           # 前端：React + TS + Vite + Tailwind
│   └── src/{api,app,components,features,lib}
├── seed/projects.json             # 5 条种子数据
├── scripts/                       # 构建脚本、curl 自测、验收清单
└── data/                          # 运行时生成的 SQLite 数据库（已 gitignore）
```

## 环境要求

- JDK 17 或更高（`java -version` 可用即可；Maven 由 Wrapper 自动下载）
- Node.js 20+ 与 npm（仅构建 / 开发前端时需要，仓库内已附可直接使用的预构建产物）

## 构建

一键完成「构建前端 → 复制进后端资源目录 → 打 jar」：

```bash
./scripts/build.sh          # macOS / Linux / Git Bash
```

```powershell
./scripts/build.ps1         # Windows PowerShell
```

产物为 `server/target/personal-space.jar`。手动分步等价于：

```bash
cd web && npm ci && npm run build
rm -rf ../server/src/main/resources/static && cp -R dist ../server/src/main/resources/static
cd ../server && ./mvnw -q clean package
```

## 启动

```bash
java -jar server/target/personal-space.jar
# 打开 http://127.0.0.1:8787
```

| 参数 | 环境变量 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `--host <addr>` | `PSPACE_HOST` | `127.0.0.1` | 监听地址 |
| `-p, --port <port>` | `PSPACE_PORT` | `8787` | 监听端口 |
| `--db <file>` | `PSPACE_DB` | `data/personal-space.db` | SQLite 数据库文件 |
| `--static-dir <dir>` | `PSPACE_STATIC_DIR` | 无 | 改从磁盘目录读前端产物（开发用，默认读 jar 内资源） |
| | `PSPACE_GITHUB_TOKEN` / `GITHUB_TOKEN` | 无 | 可选的 GitHub 令牌，读取仓库简介时提高速率上限（服务端使用，不下发前端） |
| `-h, --help` | | | 显示用法 |

数据库文件不存在时自动建表；项目表为空时自动导入 `seed/projects.json`（已打进 jar）。

### 开发模式（前后端分离、前端热更新）

```bash
java -jar server/target/personal-space.jar --static-dir web/dist   # 终端 1：后端 :8787
cd web && npm run dev                                              # 终端 2：Vite :5173，/api 代理到 :8787
```

## 链接规则（GitHub 仓库 / 演示网址）

每个项目有两个链接字段：`repoUrl`（GitHub 仓库，**必填**）与 `siteUrl`（演示网址，选填）。

- **GitHub 仓库地址必填**：不填 → 400 `validation_error`，提示 `repoUrl（GitHub 仓库） 不能为空`；只填演示网址、不填仓库同样被拦。
- **演示网址可以不填**：只填仓库，或仓库 + 演示都填，都合法。
- 只填 `repoUrl` 时，卡片与详情页只有「仓库」入口；填了 `siteUrl` 才会出现「立即预览」/「打开演示」。
- 两个链接都必须以 `http://` 或 `https://` 开头且包含主机名，其它协议（如 `ftp://`）→ 400。
- 演示网址可以就是 GitHub、Google 这类**需要登录**的页面（例如 `https://github.com/login`、`https://accounts.google.com/signin`）：它们不允许被 iframe 内嵌，界面会自动换成「打开演示」并在新标签直接跳转，不再白等 8 秒（见下文「演示预览的降级行为」）。
- `repoUrl` 指向 github.com 时，粘贴后会自动带出仓库简介（见下一节）；其它域名照样能保存，只是没有自动填充。
- 前端 `web/src/features/projects/lib/form.ts` 的 `validateForm` 与后端 `Validate.requireUrl` 规则一一对应，先在前端拦一轮，减少 400 往返；POST 与 PUT 走同一套校验。

## 粘贴 GitHub 地址，自动填充简介

在「GitHub 仓库」里粘贴 `https://github.com/owner/repo`（带 `www.`、`.git` 后缀或 `/tree/main` 之类都能认出来）之后：

- 前端去抖 500ms 调 `GET /api/github/repo?url=...`，后端读取 `https://api.github.com/repos/owner/repo`，结果在内存里缓存 10 分钟；
- **简介为空**时自动填入仓库的 description；你已经写过的文案**不会被覆盖**；
- 摘要框上方出现「GitHub 上的简介」建议卡，点「使用」即可套用；
- 光标在**简介输入框**里时，按 `Enter` 采用建议、`Shift+Enter` 换行（输入法组合状态下不会误触），采纳后 Toast 上带「撤销」；
- 读不到（仓库私有 / 断网 / 触发速率限制）只提示一句，不影响手写，也不影响保存；连接被重置这类偶发失败服务端会自动重试一次（超时 12 秒）。

可选：把 `PSPACE_GITHUB_TOKEN`（或 `GITHUB_TOKEN`）设成 GitHub personal access token 可提高匿名速率上限；请求由服务端发出，令牌不会进前端。

响应字段：`{owner, name, fullName, summarySuggestion, description, homepage, language, stars, forks, topics, htmlUrl, license, pushedAt, cached}`。


## API

Base URL `http://127.0.0.1:8787`，请求与响应均为 UTF-8 JSON。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查：状态、版本、项目数、片段数、运行时长、数据库路径 |
| GET | `/api/projects` | 项目列表；支持 `q`（标题 / 简介 / 语言 / 标签 / 代码内容 / 文件名）、`tag`、`language`、`status`、`pinned` |
| POST | `/api/projects` | 新建项目，返回 201 与 `Location` 头 |
| GET | `/api/projects/:id` | 单个项目（含代码片段） |
| PUT | `/api/projects/:id` | 全量更新，校验规则与 POST 相同（含「GitHub 仓库地址必填」） |
| DELETE | `/api/projects/:id` | 删除，返回 `{ok: true, id}` |
| PATCH | `/api/projects/order` | 拖拽排序，body `{"ids": ["p_a", "p_b"]}` |
| GET | `/api/github/repo` | 代取 GitHub 仓库信息（`?url=https://github.com/owner/repo`），供自动填充简介；非 github.com → 400，仓库不存在 → 404，触发速率限制 → 429，抓取失败 → 502 |
| GET | `/api/tags` | 标签及使用次数 |
| GET | `/api/settings` | 全局设置（主题 / 主色 / 视图 / 排序 / 密度 / 演示视口） |
| PUT | `/api/settings` | 局部更新设置 |
| POST | `/api/assets` | 上传封面图（Content-Type 为 image/png、image/jpeg、image/gif、image/webp、image/svg+xml、image/avif，≤ 4MB），返回 `{id, url, ...}` |
| GET | `/api/assets/:id` | 读取封面图（带 ETag 与长缓存） |

错误结构统一为：

```json
{ "error": "validation_error", "message": "repoUrl（GitHub 仓库） 不能为空" }
```

状态码：400 入参校验失败、404 资源不存在、405 方法不支持、415 媒体类型不支持、500 服务器内部错误。

新建项目的请求体示例（`siteUrl` 可省略，省略后卡片只显示「仓库」入口）：

```json
{
  "title": "httplite",
  "summary": "零依赖的 C++17 HTTP 服务端库",
  "repoUrl": "https://github.com/example/httplite",
  "siteUrl": "https://httplite.example.dev/",
  "tags": ["C++", "网络"],
  "language": "C++",
  "status": "active",
  "stars": 642,
  "demoLogin": false,
  "pinned": true,
  "snippets": [{ "filename": "examples/hello.cpp", "language": "cpp", "code": "int main() {}\n" }]
}
```

`status` 只能是 `active / wip / paused / archived / idea`；`stars` 取值 0-1000000；标签最多 12 个、单个不超过 24 字符；每个项目最多 30 段代码；`demoLogin`（默认 `false`）标记演示页需要登录，置 `true` 时前端一律不内嵌、点击直接在新标签打开。

## 自测与验收

```bash
./scripts/smoke-test.sh                 # macOS / Linux / Git Bash
./scripts/smoke-test.ps1                # Windows PowerShell
```

脚本用 curl 覆盖全部端点，包含「没填 GitHub 仓库 → 400」「只填仓库 → 201」「仓库 + 演示 → 201」「演示标记需要登录 → 201」「PUT 清空仓库 → 400」「非法协议 → 400」「`/api/github/repo` 缺参 → 400、非 github.com → 400」等用例，并在结束时清理测试数据（受限网络下真实抓取 GitHub 会自动 SKIP 而不是 FAIL）。针对已启动的服务运行：

```bash
java -jar server/target/personal-space.jar &
BASE_URL=http://127.0.0.1:8787 ./scripts/smoke-test.sh
```

逐项功能核对见 `scripts/acceptance-checklist.md`（英文版：`scripts/acceptance-checklist.en.md`）。

## 主题自定义

所有颜色令牌集中在 `web/src/index.css`，以 CSS 变量（RGB 三元组）暴露，主题通过 `data-theme` 切换：

```css
[data-theme="midnight"] {
  --c-bg: 11 13 18;
  --c-surface: 20 23 31;
  --c-accent: 124 156 255;
}
```

内置 6 套：`minimal` 极简明亮、`midnight` 午夜暗黑、`glass` 玻璃拟态、`terminal` 终端绿、`paper` 暖阳纸感、`neon` 霓虹赛博。

自定义主色时，前端会：

1. 写入后端 `PUT /api/settings` 的 `accent`（6 位十六进制，例如 `#7c5cff`）；
2. 同时镜像到 localStorage 的 `pspace:settings`；
3. 在 `documentElement` 上设置 `data-accent="custom"` 并覆盖 `--c-accent`。

`web/index.html` 里有一段内联脚本会在首屏渲染前先读 localStorage 上色，所以**不会出现白屏闪烁**，后端不可用时主题也照常生效。

新增一套主题：在 `web/src/index.css` 增加 `[data-theme="名字"]` 变量块，在 `web/src/lib/theme.ts` 的 `THEMES` 里注册，并把 id 加进后端 `Settings.THEMES`（否则保存设置会 400）。

## 演示预览的降级行为

「立即预览」用 iframe 内嵌演示地址，支持桌面 / 平板 / 手机三种视口、刷新、复制链接、新标签打开。若目标站点用 `X-Frame-Options` 或 CSP 拒绝内嵌，或 8 秒内未加载完成，会自动降级为封面图占位并给出打开链接——这是浏览器的同源策略限制，任何前端方案都绕不过。

### 需要登录 / 禁止内嵌的地址：直接跳转

`github.com`、`accounts.google.com`、`x.com`、`youtube.com` 等站点，以及路径里带 `login` / `signin` / `auth` / `oauth` / `sso` 的地址（判定表在 `web/src/features/demo/lib/embed.ts` 的 `NO_FRAME_HOSTS` 与 `LOGIN_PATH`），内嵌注定只得到空白页，所以**不再尝试内嵌**：

- 卡片上的按钮由「立即预览」变成「打开演示」，点击直接在新标签跳转到目标站点；
- 详情页预览区直接显示封面占位 + 原因说明 + 「打开 …」按钮，隐藏视口切换与刷新；
- 想强行试一次仍可点「仍然内嵌试试」，此时不再拦你；
- 自建演示站需要 GitHub / Google 登录时，也可以在表单里手动勾选「演示页需要登录」（后端字段 `demoLogin`），效果相同。

不认识的地址一律按「可内嵌」处理，交给 iframe 的失败降级兜底。

## 实现说明

后端这一轮采用 Java 17（已确认可以）。REST 契约、前端 `web/` 与种子 `seed/` 与 C++17 方案完全一致：若将来要换成 C++17（cpp-httplib + nlohmann/json + 内嵌 SQLite + CMake 单可执行文件），只需替换 `server/` 目录，前端与种子数据可直接复用。
