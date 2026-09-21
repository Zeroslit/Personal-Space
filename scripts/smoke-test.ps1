# curl 端到端自测：覆盖全部 REST 端点、「GitHub 地址必填」规则与 GitHub 代取接口
# 用法：$env:BASE_URL='http://127.0.0.1:8787'; ./scripts/smoke-test.ps1
$ErrorActionPreference = 'Stop'

$BaseUrl = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://127.0.0.1:8787' }

$curlCmd = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curlCmd) { throw '缺少 curl.exe（Windows 10 1803+ 自带）' }
$curl = $curlCmd.Source

$script:Pass = 0
$script:Fail = 0
$script:Status = ''
$script:Body = ''

function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Invoke-Curl {
  param([string]$Method, [string]$Path, [string]$Json)
  $outFile = [System.IO.Path]::GetTempFileName()
  $jsonFile = $null
  $curlArgs = @('-sS', '-o', $outFile, '-w', '%{http_code}', '-X', $Method)
  if ($PSBoundParameters.ContainsKey('Json')) {
    $jsonFile = [System.IO.Path]::GetTempFileName()
    Write-Utf8 $jsonFile $Json
    $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$jsonFile")
  }
  $curlArgs += "$BaseUrl$Path"
  $script:Status = (& $curl @curlArgs) -join ''
  $script:Body = [System.IO.File]::ReadAllText($outFile)
  Remove-Item -LiteralPath $outFile -Force -ErrorAction SilentlyContinue
  if ($jsonFile) { Remove-Item -LiteralPath $jsonFile -Force -ErrorAction SilentlyContinue }
}

function Test-Status([string]$Expected, [string]$Label) {
  if ($script:Status -eq $Expected) {
    $script:Pass++
    Write-Host ("  PASS " + $Label + " (" + $script:Status + ")") -ForegroundColor Green
  } else {
    $script:Fail++
    Write-Host ("  FAIL " + $Label + "：期望 " + $Expected + "，实际 " + $script:Status) -ForegroundColor Red
    Write-Host ("       " + $script:Body)
  }
}

function Test-Body([string]$Needle, [string]$Label) {
  if ($script:Body -like ("*" + $Needle + "*")) {
    $script:Pass++
    Write-Host ("  PASS " + $Label) -ForegroundColor Green
  } else {
    $script:Fail++
    Write-Host ("  FAIL " + $Label + "：响应缺少 " + $Needle) -ForegroundColor Red
    Write-Host ("       " + $script:Body)
  }
}

function Write-Skip([string]$Label) {
  Write-Host ("  SKIP " + $Label) -ForegroundColor Yellow
}

function Get-IdFromBody {
  if ($script:Body -match '"id"\s*:\s*"([^"]+)"') { return $Matches[1] }
  return ''
}

function Get-StatusCode([string]$Method, [string]$Path) {
  return ((& $curl -sS -o ([System.IO.Path]::GetTempFileName()) -w '%{http_code}' -X $Method "$BaseUrl$Path") -join '')
}

Write-Host ("目标服务：" + $BaseUrl)

Write-Host ''
Write-Host '[1] 健康检查与列表'
Invoke-Curl GET '/api/health'
Test-Status '200' 'GET /api/health'
Test-Body '"status":"ok"' '健康检查返回 status=ok'
Invoke-Curl GET '/api/projects'
Test-Status '200' 'GET /api/projects'
Test-Body '"items"' '列表返回 items'
Invoke-Curl GET '/api/projects?q=react&pinned=true'
Test-Status '200' 'GET /api/projects?q=&pinned='

Write-Host ''
Write-Host '[2] 链接规则：GitHub 仓库地址必填'
Invoke-Curl POST '/api/projects' '{"title":"smoke 没有 GitHub 地址"}'
Test-Status '400' '没填 repoUrl → 400'
Test-Body 'validation_error' '400 返回统一错误结构 {error, message}'
Test-Body 'repoUrl' '错误信息点名 repoUrl'
Invoke-Curl POST '/api/projects' '{"title":"smoke 只有演示网址","siteUrl":"https://example.com/demo"}'
Test-Status '400' '只填 siteUrl 不填 repoUrl → 400'
Invoke-Curl POST '/api/projects' '{"title":"smoke 非法协议","repoUrl":"ftp://example.com"}'
Test-Status '400' '非 http(s) 协议 → 400'
Invoke-Curl POST '/api/projects' '{"title":"   ","repoUrl":"https://example.com"}'
Test-Status '400' '空标题 → 400'

Write-Host ''
Write-Host '[3] GitHub 仓库解析（粘贴地址自动填充简介的后端）'
Invoke-Curl GET '/api/github/repo'
Test-Status '400' '缺少 url 参数 → 400'
Invoke-Curl GET '/api/github/repo?url=https%3A%2F%2Fgitlab.com%2Fa%2Fb'
Test-Status '400' '非 github.com 地址 → 400'
$probe = [System.IO.Path]::GetTempFileName()
$code = ((& $curl -sS -o $probe -w '%{http_code}' "$BaseUrl/api/github/repo?url=https%3A%2F%2Fgithub.com%2Fopenai%2Fopenai-python") -join '')
$remote = [System.IO.File]::ReadAllText($probe)
Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
if ($code -eq '200') {
  $script:Pass++
  Write-Host '  PASS GET /api/github/repo?url=github.com/openai/openai-python（联网可用）' -ForegroundColor Green
  if ($remote -like '*"summarySuggestion"*') {
    $script:Pass++
    Write-Host '  PASS 返回里带 summarySuggestion' -ForegroundColor Green
  } else {
    $script:Fail++
    Write-Host ('  FAIL 返回里没有 summarySuggestion：' + $remote) -ForegroundColor Red
  }
} elseif ($code -eq '429' -or $code -eq '502' -or $code -eq '504') {
  Write-Skip ('真实抓取跳过：本机访问不到 GitHub（HTTP ' + $code + '）')
} else {
  $script:Fail++
  Write-Host ('  FAIL 真实抓取返回了意外状态 ' + $code + '：' + $remote) -ForegroundColor Red
}

Write-Host ''
Write-Host '[4] 建立测试项目'
Invoke-Curl POST '/api/projects' '{"title":"smoke 只有仓库","repoUrl":"https://github.com/example/smoke-a","tags":["smoke"],"language":"TypeScript","status":"active","stars":3}'
Test-Status '201' '只填 repoUrl → 201'
$idRepo = Get-IdFromBody
Invoke-Curl POST '/api/projects' '{"title":"smoke 两个都填","repoUrl":"https://github.com/example/smoke-b","siteUrl":"https://example.com/b","tags":["smoke"],"snippets":[{"filename":"a.ts","language":"typescript","code":"export const a = 1;\n"}]}'
Test-Status '201' '两个都填 → 201'
$idBoth = Get-IdFromBody
Invoke-Curl POST '/api/projects' '{"title":"smoke 演示需要登录","repoUrl":"https://github.com/example/smoke-c","siteUrl":"https://accounts.google.com/signin","demoLogin":true,"tags":["smoke"]}'
Test-Status '201' '演示标记为需要登录 → 201'
$idLogin = Get-IdFromBody
Test-Body '"demoLogin":true' 'demoLogin 已保存'

if (-not $idRepo -or -not $idBoth -or -not $idLogin) {
  Write-Host '  FAIL 无法从响应中解析新建项目 id，后续用例中止' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '[5] 详情 / 更新 / 排序 / 标签 / 设置'
Invoke-Curl GET "/api/projects/$idLogin"
Test-Status '200' 'GET /api/projects/:id'
Invoke-Curl GET "/api/projects/$idBoth"
Test-Status '200' 'GET /api/projects/:id（带片段）'
Test-Body '"snippets"' '详情包含代码片段'
Invoke-Curl PUT "/api/projects/$idRepo" '{"title":"smoke 只有仓库（改了标题和演示）","repoUrl":"https://github.com/example/smoke-a","siteUrl":"https://example.com/renamed"}'
Test-Status '200' 'PUT 更新链接'
Invoke-Curl PUT "/api/projects/$idRepo" '{"title":"smoke 清空 repoUrl","siteUrl":"https://example.com/renamed"}'
Test-Status '400' 'PUT 清空 repoUrl → 400'
Invoke-Curl PUT "/api/projects/$idBoth" '{"title":"smoke 清空所有链接"}'
Test-Status '400' 'PUT 清空所有链接 → 400'
Invoke-Curl PATCH '/api/projects/order' ('{"ids":["' + $idLogin + '","' + $idBoth + '","' + $idRepo + '"]}')
Test-Status '200' 'PATCH /api/projects/order'
Test-Body '"items"' '排序返回排序后的列表'
Invoke-Curl GET '/api/tags'
Test-Status '200' 'GET /api/tags'
Invoke-Curl GET '/api/settings'
Test-Status '200' 'GET /api/settings'
Invoke-Curl PUT '/api/settings' '{"theme":"midnight"}'
Test-Status '200' 'PUT /api/settings 切换主题'
Invoke-Curl PUT '/api/settings' '{"theme":"not-a-theme"}'
Test-Status '400' '非法主题 → 400'
Invoke-Curl PUT '/api/settings' '{"accent":"#7c5cff"}'
Test-Status '200' 'PUT /api/settings 自定义主色'
Invoke-Curl PUT '/api/settings' '{"accent":"红色"}'
Test-Status '400' '非法主色 → 400'

Write-Host ''
Write-Host '[6] 封面图上传'
$png = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllBytes($png, [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/8iH4AAAAAElFTkSuQmCC'))
$outFile = [System.IO.Path]::GetTempFileName()
$script:Status = ((& $curl -sS -o $outFile -w '%{http_code}' -X POST -H 'Content-Type: image/png' --data-binary "@$png" "$BaseUrl/api/assets") -join '')
$script:Body = [System.IO.File]::ReadAllText($outFile)
Remove-Item -LiteralPath $outFile -Force -ErrorAction SilentlyContinue
Test-Status '201' 'POST /api/assets 上传 PNG'
if ($script:Body -match '"url"\s*:\s*"([^"]+)"') {
  $assetUrl = $Matches[1]
  $code = Get-StatusCode 'GET' $assetUrl
  if ($code -eq '200') {
    $script:Pass++
    Write-Host ("  PASS GET " + $assetUrl + " 读取已上传封面") -ForegroundColor Green
  } else {
    $script:Fail++
    Write-Host ("  FAIL 读取已上传封面：期望 200，实际 " + $code) -ForegroundColor Red
  }
}
$plain = [System.IO.Path]::GetTempFileName()
Write-Utf8 $plain 'x'
$code = ((& $curl -sS -o ([System.IO.Path]::GetTempFileName()) -w '%{http_code}' -X POST -H 'Content-Type: text/plain' --data-binary "@$plain" "$BaseUrl/api/assets") -join '')
if ($code -eq '415') {
  $script:Pass++
  Write-Host '  PASS 非图片类型 → 415' -ForegroundColor Green
} else {
  $script:Fail++
  Write-Host ("  FAIL 非图片类型：期望 415，实际 " + $code) -ForegroundColor Red
}
Remove-Item -LiteralPath $png, $plain -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '[7] 错误处理与 SPA 兜底'
Invoke-Curl GET '/api/projects/p_not_exists_at_all'
Test-Status '404' '不存在的项目 → 404'
Invoke-Curl POST '/api/health'
Test-Status '405' '错误方法 → 405'
Invoke-Curl GET '/p/anything'
Test-Status '200' 'SPA 兜底 /p/anything'
Test-Body 'id="root"' '返回前端页面'

Write-Host ''
Write-Host '[8] 清理测试数据'
foreach ($id in @($idRepo, $idBoth, $idLogin)) {
  Invoke-Curl DELETE "/api/projects/$id"
  Test-Status '200' ("DELETE /api/projects/" + $id)
}
Invoke-Curl GET "/api/projects/$idBoth"
Test-Status '404' '删除后读取 → 404'

Write-Host ''
Write-Host ("结果：" + $script:Pass + " 通过，" + $script:Fail + " 失败")
if ($script:Fail -gt 0) { exit 1 }
