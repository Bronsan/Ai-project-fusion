#!/usr/bin/env bash
# ============================================================================
# ProjectFusion v0.10 自动环境配置脚本（Linux / macOS）
# 功能：检测并安装 Go / Node.js / Wails CLI / 前端依赖，带进度条
# 用法：chmod +x scripts/setup.sh && ./scripts/setup.sh
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 版本要求
GO_MIN_VERSION="1.21"
NODE_MIN_VERSION="18"
WAILS_VERSION="v2.12.0"

# 进度条相关
PROGRESS_WIDTH=40
CURRENT_STEP=0
TOTAL_STEPS=7

# ============================================================================
# 进度条函数
# ============================================================================
show_progress() {
    local percent=$(( (CURRENT_STEP * 100) / TOTAL_STEPS ))
    local filled=$(( (percent * PROGRESS_WIDTH) / 100 ))
    local empty=$(( PROGRESS_WIDTH - filled ))
    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done
    printf "\r${CYAN}[${bar}]${NC} ${percent}%% - $1"
    if [ "$percent" -eq 100 ]; then
        printf "\n"
    fi
}

next_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
}

# ============================================================================
# 检测函数
# ============================================================================
check_go() {
    if command -v go &> /dev/null; then
        local version=$(go version 2>/dev/null | grep -oE 'go[0-9]+\.[0-9]+' | head -1 | sed 's/go//')
        if [ -n "$version" ]; then
            local major=$(echo "$version" | cut -d. -f1)
            local minor=$(echo "$version" | cut -d. -f2)
            local req_major=$(echo "$GO_MIN_VERSION" | cut -d. -f1)
            local req_minor=$(echo "$GO_MIN_VERSION" | cut -d. -f2)
            if [ "$major" -gt "$req_major" ] || ([ "$major" -eq "$req_major" ] && [ "$minor" -ge "$req_minor" ]); then
                echo "ok:$version"
                return 0
            fi
        fi
        echo "old:$version"
        return 1
    fi
    echo "missing"
    return 1
}

check_node() {
    if command -v node &> /dev/null; then
        local version=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
        if [ -n "$version" ] && [ "$version" -ge "$NODE_MIN_VERSION" ]; then
            echo "ok:$version"
            return 0
        fi
        echo "old:$version"
        return 1
    fi
    echo "missing"
    return 1
}

check_wails() {
    if command -v wails &> /dev/null; then
        echo "ok"
        return 0
    fi
    echo "missing"
    return 1
}

# ============================================================================
# 安装函数
# ============================================================================
install_go() {
    echo -e "\n${YELLOW}⚠ Go 未安装或版本过低，正在安装 Go ${GO_MIN_VERSION}+...${NC}"
    local os_type=$(uname -s | tr '[:upper:]' '[:lower:]')
    local arch=$(uname -m)
    local go_arch="amd64"
    if [ "$arch" = "arm64" ] || [ "$arch" = "aarch64" ]; then
        go_arch="arm64"
    fi

    # 获取最新稳定版本
    local go_version="1.23.4"
    local url="https://go.dev/dl/go${go_version}.${os_type}-${go_arch}.tar.gz"

    echo -e "${BLUE}下载 ${url}${NC}"
    if [ -w /usr/local ]; then
        curl -fsSL "$url" | tar -C /usr/local -xzf -
        export PATH=$PATH:/usr/local/go/bin
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc 2>/dev/null || true
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.zshrc 2>/dev/null || true
    else
        curl -fsSL "$url" | sudo tar -C /usr/local -xzf -
        export PATH=$PATH:/usr/local/go/bin
    fi
    echo -e "${GREEN}✓ Go 安装完成${NC}"
}

install_node() {
    echo -e "\n${YELLOW}⚠ Node.js 未安装或版本过低，正在安装 Node.js ${NODE_MIN_VERSION}+...${NC}"

    # 尝试使用 NodeSource 安装
    if command -v curl &> /dev/null; then
        if [ -w /usr/local ] || [ "$(id -u)" = "0" ]; then
            curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x | bash - 2>/dev/null && \
                (apt-get install -y nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null) || true
        else
            curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x | sudo bash - 2>/dev/null && \
                sudo apt-get install -y nodejs 2>/dev/null || sudo yum install -y nodejs 2>/dev/null || true
        fi
    fi

    # 如果还是没装上，尝试 nvm
    if ! command -v node &> /dev/null; then
        echo -e "${BLUE}尝试通过 nvm 安装...${NC}"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash 2>/dev/null || true
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install ${NODE_MIN_VERSION} 2>/dev/null || true
        nvm use ${NODE_MIN_VERSION} 2>/dev/null || true
    fi

    echo -e "${GREEN}✓ Node.js 安装完成${NC}"
}

install_wails() {
    echo -e "\n${YELLOW}⚠ Wails CLI 未安装，正在安装 Wails ${WAILS_VERSION}...${NC}"
    go install github.com/wailsapp/wails/v2/cmd/wails@${WAILS_VERSION}
    export PATH=$PATH:$(go env GOPATH)/bin
    echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc 2>/dev/null || true
    echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.zshrc 2>/dev/null || true
    echo -e "${GREEN}✓ Wails CLI 安装完成${NC}"
}

install_system_deps_linux() {
    echo -e "\n${YELLOW}⚠ 检测到 Linux，正在安装 Wails 系统依赖...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y -qq \
            libgtk-3-dev libwebkit2gtk-4.1-dev pkg-config \
            libgcc1 libstdc++6 2>/dev/null || true
    elif command -v yum &> /dev/null; then
        sudo yum install -y gtk3-devel webkit2gtk3-devel pkgconfig 2>/dev/null || true
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y gtk3-devel webkit2gtk4.1-devel pkgconfig 2>/dev/null || true
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm gtk3 webkit2gtk pkgconf 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ 系统依赖安装完成${NC}"
}

install_system_deps_macos() {
    echo -e "\n${YELLOW}⚠ 检测到 macOS，正在检查 Xcode Command Line Tools...${NC}"
    if ! xcode-select -p &> /dev/null; then
        xcode-select --install 2>/dev/null || true
        echo -e "${YELLOW}请完成 Xcode Command Line Tools 安装后重新运行此脚本${NC}"
    else
        echo -e "${GREEN}✓ Xcode Command Line Tools 已安装${NC}"
    fi
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║     ProjectFusion v0.11beta 环境自动配置脚本              ║"
    echo "║     AI 驱动的开源项目智能融合工坊                        ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    local os_type=$(uname -s)

    # 步骤 1：检测 Go
    next_step
    show_progress "检测 Go 环境..."
    local go_status=$(check_go)
    if echo "$go_status" | grep -q "^ok"; then
        echo -e "\n${GREEN}✓ Go $(echo $go_status | cut -d: -f2) 已安装${NC}"
    else
        install_go
    fi

    # 步骤 2：检测 Node.js
    next_step
    show_progress "检测 Node.js 环境..."
    local node_status=$(check_node)
    if echo "$node_status" | grep -q "^ok"; then
        echo -e "\n${GREEN}✓ Node.js $(echo $node_status | cut -d: -f2) 已安装${NC}"
    else
        install_node
    fi

    # 步骤 3：检测 npm
    next_step
    show_progress "检测 npm..."
    if command -v npm &> /dev/null; then
        echo -e "\n${GREEN}✓ npm $(npm -v) 已安装${NC}"
    else
        echo -e "\n${RED}✗ npm 未安装，请手动安装 Node.js${NC}"
        exit 1
    fi

    # 步骤 4：安装 Wails CLI
    next_step
    show_progress "检测 Wails CLI..."
    if check_wails | grep -q "ok"; then
        echo -e "\n${GREEN}✓ Wails CLI 已安装${NC}"
    else
        install_wails
    fi

    # 步骤 5：安装系统依赖
    next_step
    show_progress "安装系统依赖..."
    if [ "$os_type" = "Linux" ]; then
        install_system_deps_linux
    elif [ "$os_type" = "Darwin" ]; then
        install_system_deps_macos
    fi

    # 步骤 6：安装前端依赖
    next_step
    show_progress "安装前端依赖 (npm install)..."
    cd "$(dirname "$0")/.."
    if [ -f package.json ]; then
        npm install --silent 2>&1 | tail -5
        echo -e "\n${GREEN}✓ 前端依赖安装完成${NC}"
    else
        echo -e "\n${YELLOW}⚠ 未找到 package.json，跳过${NC}"
    fi

    # 步骤 7：下载 Go 依赖
    next_step
    show_progress "下载 Go 依赖 (go mod download)..."
    if [ -f go.mod ]; then
        export GOPROXY=https://goproxy.cn,direct
        go mod download 2>&1 | tail -3
        echo -e "\n${GREEN}✓ Go 依赖下载完成${NC}"
    else
        echo -e "\n${YELLOW}⚠ 未找到 go.mod，跳过${NC}"
    fi

    # 完成
    show_progress "配置完成！"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ✓ 环境配置完成！                             ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  下一步操作：                                             ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║  开发模式（热重载）：                                     ║${NC}"
    echo -e "${GREEN}║    wails dev                                              ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║  生产构建：                                               ║${NC}"
    echo -e "${GREEN}║    wails build                                            ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║  Web 模式（降级）：                                       ║${NC}"
    echo -e "${GREEN}║    npm run dev                                            ║${NC}"
    echo -e "${GREEN}║                                                          ║${NC}"
    echo -e "${GREEN}║  产物位置：build/bin/ProjectFusion                        ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}ProjectFusion v0.11beta - AI 驱动的开源项目智能融合工坊${NC}"
}

main "$@"
