# ============================================================================
# ProjectFusion v0.10 自动环境配置脚本（Windows PowerShell）
# 功能：检测并安装 Go / Node.js / Wails CLI / 前端依赖，带进度条
# 用法：powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# ============================================================================

$ErrorActionPreference = "Stop"

# 版本要求
$GO_MIN_VERSION = "1.21"
$NODE_MIN_VERSION = "18"
$WAILS_VERSION = "v2.12.0"

# 进度条相关
$TOTAL_STEPS = 7
$CURRENT_STEP = 0

# ============================================================================
# 进度条函数
# ============================================================================
function Show-Progress {
    param([string]$Message)
    $percent = [math]::Floor(($CURRENT_STEP * 100) / $TOTAL_STEPS)
    $filled = [math]::Floor(($percent * 40) / 100)
    $empty = 40 - $filled
    $bar = ("█" * $filled) + ("░" * $empty)
    Write-Host "`r[$bar] $percent% - $Message" -NoNewline -ForegroundColor Cyan
    if ($percent -eq 100) {
        Write-Host ""
    }
}

function Next-Step {
    $script:CURRENT_STEP = $script:CURRENT_STEP + 1
}

# ============================================================================
# 检测函数
# ============================================================================
function Check-Go {
    try {
        $version = (go version 2>$null) -replace '.*go(\d+\.\d+).*', '$1'
        if ($version) {
            $parts = $version.Split('.')
            $major = [int]$parts[0]
            $minor = [int]$parts[1]
            if ($major -gt 1 -or ($major -eq 1 -and $minor -ge 21)) {
                return @{ Status = "ok"; Version = $version }
            }
            return @{ Status = "old"; Version = $version }
        }
    } catch {}
    return @{ Status = "missing" }
}

function Check-Node {
    try {
        $version = (node -v 2>$null) -replace 'v(\d+)\..*', '$1'
        if ($version -and [int]$version -ge $NODE_MIN_VERSION) {
            return @{ Status = "ok"; Version = $version }
        }
        return @{ Status = "old"; Version = $version }
    } catch {}
    return @{ Status = "missing" }
}

function Check-Wails {
    try {
        $null = wails version 2>$null
        if ($LASTEXITCODE -eq 0) {
            return @{ Status = "ok" }
        }
    } catch {}
    return @{ Status = "missing" }
}

# ============================================================================
# 安装函数
# ============================================================================
function Install-Go {
    Write-Host ""
    Write-Host "⚠ Go 未安装或版本过低，正在安装 Go $GO_MIN_VERSION+..." -ForegroundColor Yellow

    $goVersion = "1.23.4"
    $url = "https://go.dev/dl/go$goVersion.windows-amd64.msi"

    Write-Host "下载 $url" -ForegroundColor Blue
    $tempFile = "$env:TEMP\go-installer.msi"
    Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i", $tempFile, "/quiet" -Wait
    Remove-Item $tempFile -Force

    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "✓ Go 安装完成" -ForegroundColor Green
}

function Install-Node {
    Write-Host ""
    Write-Host "⚠ Node.js 未安装或版本过低，正在安装 Node.js $NODE_MIN_VERSION+..." -ForegroundColor Yellow

    $url = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
    Write-Host "下载 $url" -ForegroundColor Blue
    $tempFile = "$env:TEMP\node-installer.msi"
    Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i", $tempFile, "/quiet" -Wait
    Remove-Item $tempFile -Force

    # 刷新 PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    Write-Host "✓ Node.js 安装完成" -ForegroundColor Green
}

function Install-Wails {
    Write-Host ""
    Write-Host "⚠ Wails CLI 未安装，正在安装 Wails $WAILS_VERSION..." -ForegroundColor Yellow
    go install "github.com/wailsapp/wails/v2/cmd/wails@$WAILS_VERSION"
    $gopath = go env GOPATH
    $env:Path += ";$gopath\bin"
    Write-Host "✓ Wails CLI 安装完成" -ForegroundColor Green
}

# ============================================================================
# 主流程
# ============================================================================
function Main {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     ProjectFusion v0.11beta 环境自动配置脚本              ║" -ForegroundColor Cyan
    Write-Host "║     AI 驱动的开源项目智能融合工坊                        ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    # 步骤 1：检测 Go
    Next-Step
    Show-Progress "检测 Go 环境..."
    $goStatus = Check-Go
    if ($goStatus.Status -eq "ok") {
        Write-Host ""
        Write-Host "✓ Go $($goStatus.Version) 已安装" -ForegroundColor Green
    } else {
        Install-Go
    }

    # 步骤 2：检测 Node.js
    Next-Step
    Show-Progress "检测 Node.js 环境..."
    $nodeStatus = Check-Node
    if ($nodeStatus.Status -eq "ok") {
        Write-Host ""
        Write-Host "✓ Node.js $($nodeStatus.Version) 已安装" -ForegroundColor Green
    } else {
        Install-Node
    }

    # 步骤 3：检测 npm
    Next-Step
    Show-Progress "检测 npm..."
    try {
        $npmVersion = npm -v 2>$null
        if ($npmVersion) {
            Write-Host ""
            Write-Host "✓ npm $npmVersion 已安装" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "✗ npm 未安装，请手动安装 Node.js" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host ""
        Write-Host "✗ npm 未安装" -ForegroundColor Red
        exit 1
    }

    # 步骤 4：安装 Wails CLI
    Next-Step
    Show-Progress "检测 Wails CLI..."
    $wailsStatus = Check-Wails
    if ($wailsStatus.Status -eq "ok") {
        Write-Host ""
        Write-Host "✓ Wails CLI 已安装" -ForegroundColor Green
    } else {
        Install-Wails
    }

    # 步骤 5：WebView2 运行时检查（Windows 10/11 通常预装）
    Next-Step
    Show-Progress "检查 WebView2 运行时..."
    $webview2Path = "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application"
    if (Test-Path $webview2Path) {
        Write-Host ""
        Write-Host "✓ WebView2 运行时已安装" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠ WebView2 运行时未检测到，正在安装..." -ForegroundColor Yellow
        $url = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
        $tempFile = "$env:TEMP\webview2-installer.exe"
        try {
            Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing
            Start-Process -FilePath $tempFile -ArgumentList "/silent", "/install" -Wait
            Remove-Item $tempFile -Force
            Write-Host "✓ WebView2 运行时安装完成" -ForegroundColor Green
        } catch {
            Write-Host "⚠ WebView2 自动安装失败，请手动安装: $url" -ForegroundColor Yellow
        }
    }

    # 步骤 6：安装前端依赖
    Next-Step
    Show-Progress "安装前端依赖 (npm install)..."
    Set-Location -Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
    if (Test-Path "package.json") {
        npm install --silent 2>&1 | Select-Object -Last 5
        Write-Host ""
        Write-Host "✓ 前端依赖安装完成" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠ 未找到 package.json，跳过" -ForegroundColor Yellow
    }

    # 步骤 7：下载 Go 依赖
    Next-Step
    Show-Progress "下载 Go 依赖 (go mod download)..."
    if (Test-Path "go.mod") {
        $env:GOPROXY = "https://goproxy.cn,direct"
        go mod download 2>&1 | Select-Object -Last 3
        Write-Host ""
        Write-Host "✓ Go 依赖下载完成" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠ 未找到 go.mod，跳过" -ForegroundColor Yellow
    }

    # 完成
    Show-Progress "配置完成！"
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║              ✓ 环境配置完成！                             ║" -ForegroundColor Green
    Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║  下一步操作：                                             ║" -ForegroundColor Green
    Write-Host "║                                                          ║" -ForegroundColor Green
    Write-Host "║  开发模式（热重载）：                                     ║" -ForegroundColor Green
    Write-Host "║    wails dev                                              ║" -ForegroundColor Green
    Write-Host "║                                                          ║" -ForegroundColor Green
    Write-Host "║  生产构建：                                               ║" -ForegroundColor Green
    Write-Host "║    wails build                                            ║" -ForegroundColor Green
    Write-Host "║                                                          ║" -ForegroundColor Green
    Write-Host "║  Web 模式（降级）：                                       ║" -ForegroundColor Green
    Write-Host "║    npm run dev                                            ║" -ForegroundColor Green
    Write-Host "║                                                          ║" -ForegroundColor Green
    Write-Host "║  产物位置：build\bin\ProjectFusion.exe                    ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "ProjectFusion v0.11beta - AI 驱动的开源项目智能融合工坊" -ForegroundColor Cyan
}

Main
