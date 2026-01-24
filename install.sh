#!/bin/bash
set -e

REPO="dev-dami/ignite"
INSTALL_DIR="${IGNITE_INSTALL_DIR:-$HOME/.ignite}"
BIN_DIR="$INSTALL_DIR/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}==>${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux*)  os="linux" ;;
        Darwin*) os="darwin" ;;
        *)       error "Unsupported OS: $(uname -s). Only Linux and macOS are supported." ;;
    esac

    case "$(uname -m)" in
        x86_64)  arch="x64" ;;
        amd64)   arch="x64" ;;
        arm64)   arch="arm64" ;;
        aarch64) arch="arm64" ;;
        *)       error "Unsupported architecture: $(uname -m). Only x64 and arm64 are supported." ;;
    esac

    echo "${os}-${arch}"
}

get_latest_version() {
    curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/'
}

download_binary() {
    local version="$1"
    local platform="$2"
    local url="https://github.com/${REPO}/releases/download/${version}/ignite-${platform}.tar.gz"
    local tmp_dir=$(mktemp -d)

    info "Downloading ignite ${version} for ${platform}..."

    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "$tmp_dir/ignite.tar.gz" || error "Download failed. Check if release exists: $url"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "$tmp_dir/ignite.tar.gz" || error "Download failed. Check if release exists: $url"
    else
        error "Neither curl nor wget found. Please install one of them."
    fi

    echo "$tmp_dir"
}

install_binary() {
    local tmp_dir="$1"
    local platform="$2"

    info "Installing to ${INSTALL_DIR}..."

    mkdir -p "$BIN_DIR"
    mkdir -p "$INSTALL_DIR/runtime-bun"
    mkdir -p "$INSTALL_DIR/runtime-node"

    tar -xzf "$tmp_dir/ignite.tar.gz" -C "$tmp_dir"

    cp "$tmp_dir/ignite-${platform}" "$BIN_DIR/ignite"
    chmod +x "$BIN_DIR/ignite"

    if [ -d "$tmp_dir/runtime-bun" ]; then
        cp -r "$tmp_dir/runtime-bun/"* "$INSTALL_DIR/runtime-bun/"
    fi
    if [ -d "$tmp_dir/runtime-node" ]; then
        cp -r "$tmp_dir/runtime-node/"* "$INSTALL_DIR/runtime-node/"
    fi

    rm -rf "$tmp_dir"
}

setup_path() {
    local shell_rc=""
    local path_export="export PATH=\"\$PATH:$BIN_DIR\""

    if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
        shell_rc="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ] || [ -f "$HOME/.bashrc" ]; then
        shell_rc="$HOME/.bashrc"
    elif [ -f "$HOME/.profile" ]; then
        shell_rc="$HOME/.profile"
    fi

    if [ -n "$shell_rc" ]; then
        if ! grep -q "$BIN_DIR" "$shell_rc" 2>/dev/null; then
            echo "" >> "$shell_rc"
            echo "# Ignite CLI" >> "$shell_rc"
            echo "$path_export" >> "$shell_rc"
            info "Added $BIN_DIR to PATH in $shell_rc"
        fi
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        warn "Docker not found. Ignite requires Docker for service execution."
        warn "Install Docker: https://docs.docker.com/get-docker/"
    else
        success "Docker found: $(docker --version)"
    fi
}

main() {
    echo ""
    echo -e "${BLUE}┌─────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│${NC}        ${GREEN}Ignite Installer${NC}             ${BLUE}│${NC}"
    echo -e "${BLUE}└─────────────────────────────────────┘${NC}"
    echo ""

    local platform=$(detect_platform)
    info "Detected platform: $platform"

    local version="${1:-$(get_latest_version)}"
    if [ -z "$version" ]; then
        version="v0.1.0"
        warn "Could not fetch latest version, using $version"
    fi

    local tmp_dir=$(download_binary "$version" "$platform")
    install_binary "$tmp_dir" "$platform"
    setup_path
    check_docker

    echo ""
    success "Ignite installed successfully!"
    echo ""
    echo "  To get started:"
    echo ""
    echo "    1. Restart your terminal or run:"
    echo "       ${YELLOW}source ~/.bashrc${NC}  (or ~/.zshrc)"
    echo ""
    echo "    2. Verify installation:"
    echo "       ${YELLOW}ignite --version${NC}"
    echo ""
    echo "    3. Create your first service:"
    echo "       ${YELLOW}ignite init my-service${NC}"
    echo "       ${YELLOW}cd my-service${NC}"
    echo "       ${YELLOW}ignite run .${NC}"
    echo ""
    echo "  Documentation: https://github.com/${REPO}"
    echo ""
}

main "$@"
