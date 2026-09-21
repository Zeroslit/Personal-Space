# 一键构建：构建前端 → 复制进后端资源目录 → 打成单个可执行 jar
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Assert-Tool([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "缺少依赖：$Name（$Hint）"
  }
}

Assert-Tool 'node' '请安装 Node.js 20+'
Assert-Tool 'java' '请安装 JDK 17 或更高'
Write-Host "-> node $(node -v) / java $((java -version 2>&1)[0])"

Write-Host '-> 构建前端（web/）'
Push-Location (Join-Path $root 'web')
try {
  if (Test-Path 'package-lock.json') { npm ci } else { npm install }
  if ($LASTEXITCODE -ne 0) { throw 'npm 安装依赖失败' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build 失败' }
} finally {
  Pop-Location
}

Write-Host '-> 复制前端产物到 server/src/main/resources/static'
$target = Join-Path $root 'server/src/main/resources/static'
if (Test-Path $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $root 'web/dist/*') -Destination $target -Recurse -Force

Write-Host '-> 打包后端（server/）'
Push-Location (Join-Path $root 'server')
try {
  if (Test-Path 'mvnw.cmd') {
    & (Join-Path $root 'server/mvnw.cmd') -q clean package
  } elseif (Get-Command mvn -ErrorAction SilentlyContinue) {
    mvn -q clean package
  } else {
    throw '找不到 mvnw.cmd 或 mvn，无法打包后端'
  }
  if ($LASTEXITCODE -ne 0) { throw 'Maven 打包失败' }
} finally {
  Pop-Location
}

Write-Host ''
Write-Host '构建完成：server/target/personal-space.jar'
Write-Host '启动：java -jar server/target/personal-space.jar'
