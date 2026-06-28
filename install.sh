#!/bin/bash
set -euo pipefail

REPO_URL="https://github.com/dev-dami/ignite.git"
INSTALL_DIR="${IGNITE_INSTALL_DIR:-$HOME/.local}"
BIN_DIR="$INSTALL_DIR/bin"
CLONE_DIR="${IGNITE_BUILD_DIR:-$(mktemp -d)/ignite}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_banner() {
    echo -e "${CYAN}${BOLD}"
    cat << 'EOF'
    ╦╔═╗╔╗╔╦╔╦╗╔═╗
    ║║ ╦║║║║ ║ ║╣ 
    ╩╚═╝╝╚╝╩ ╩ ╚═╝
EOF
    echo -e "${NC}"
    echo -e "  ${DIM}Run JS/TS microservices in Docker${NC}"
    echo ""
}

info()  { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
error() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

check_rust() {
    if ! command -v rustc &>/dev/null || ! command -v cargo &>/dev/null; then
        warn "Rust toolchain not found. Installing via rustup..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
        source "$HOME/.cargo/env"
        info "Rust toolchain installed: $(rustc --version)"
    else
        info "Rust: $(rustc --version)"
    fi
}

check_git() {
    command -v git &>/dev/null || error "git is required but not installed."
    info "git: $(git --version)"
}

clone_repo() {
    echo -e "\n  ${BLUE}>${NC} Cloning repository..."
    rm -rf "$CLONE_DIR"
    git clone --depth 1 "$REPO_URL" "$CLONE_DIR"
    info "Repository cloned"
}

build_cli() {
    echo -e "\n  ${BLUE}>${NC} Building ignite CLI (release mode)..."
    cargo build --release --bin ignite-cli --manifest-path "$CLONE_DIR/Cargo.toml"
    info "Build complete"
}

install_binary() {
    echo -e "\n  ${BLUE}>${NC} Installing to $BIN_DIR..."
    mkdir -p "$BIN_DIR"
    cp "$CLONE_DIR/target/release/ignite-cli" "$BIN_DIR/ignite"
    chmod +x "$BIN_DIR/ignite"
    info "Binary installed: $BIN_DIR/ignite"
}

setup_path() {
    if echo "$PATH" | grep -q "$BIN_DIR"; then
        info "PATH already configured"
        return
    fi

    local shell_rc=""
    local path_export="export PATH=\"\$PATH:$BIN_DIR\""

    if [ -f "$HOME/.zshrc" ]; then
        shell_rc="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
        shell_rc="$HOME/.bashrc"
    elif [ -f "$HOME/.config/fish/config.fish" ]; then
        shell_rc="$HOME/.config/fish/config.fish"
        path_export="set -gx PATH \$PATH $BIN_DIR"
    elif [ -f "$HOME/.profile" ]; then
        shell_rc="$HOME/.profile"
    fi

    if [ -n "$shell_rc" ] && ! grep -q "$BIN_DIR" "$shell_rc" 2>/dev/null; then
        echo -e "\n# Ignite CLI\n$path_export" >> "$shell_rc"
        info "Added to PATH in $(basename "$shell_rc")"
    fi
}

setup_kvm_group() {
    [ "$(uname -s)" != "Linux" ] && return
    [ ! -e /dev/kvm ] && { warn "KVM not available, skipping group setup"; return; }

    if groups | grep -qw kvm; then
        info "Already in kvm group"
        return
    fi

    if command -v sudo &>/dev/null; then
        echo -e "\n  ${BLUE}>${NC} Adding user to kvm group (requires sudo)..."
        sudo usermod -aG kvm "$USER" && info "Added to kvm group" || warn "Failed to add to kvm group"
        echo -e "  ${YELLOW}!${NC} Run ${BOLD}newgrp kvm${NC} or re-login for group change to take effect"
    else
        warn "sudo not available. Run manually: sudo usermod -aG kvm $USER"
    fi
}

cleanup() {
    rm -rf "$CLONE_DIR"
}

show_usage() {
    echo "Ignite Installer"
    echo ""
    echo "Usage: install.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install    Clone, build, and install ignite (default)"
    echo "  uninstall  Remove ignite from $BIN_DIR"
    echo "  help       Show this help"
    echo ""
    echo "Environment variables:"
    echo "  IGNITE_INSTALL_DIR  Installation prefix (default: \$HOME/.local)"
    echo "  IGNITE_BUILD_DIR    Build directory (default: temp dir)"
    echo ""
    echo "Examples:"
    echo "  curl -fsSL https://raw.githubusercontent.com/dev-dami/ignite/main/install.sh | bash"
    echo "  curl -fsSL .../install.sh | bash -s install"
    echo "  curl -fsSL .../install.sh | bash -s uninstall"
    echo ""
}

do_uninstall() {
    echo -e "\n  ${CYAN}Uninstalling Ignite${NC}\n"
    if [ -f "$BIN_DIR/ignite" ]; then
        rm -f "$BIN_DIR/ignite"
        info "Removed $BIN_DIR/ignite"
    else
        warn "ignite not found in $BIN_DIR"
    fi
    echo ""
}

main() {
    print_banner

    case "${1:-install}" in
        install)
            check_git
            check_rust
            clone_repo
            build_cli
            install_binary
            setup_path
            setup_kvm_group
            cleanup
            echo ""
            echo -e "  ${GREEN}${BOLD}✓ Installation complete!${NC}"
            echo ""
            echo -e "  ${DIM}Restart your terminal or run:${NC}"
            echo -e "  ${YELLOW}source ~/.bashrc${NC} ${DIM}(or ~/.zshrc)${NC}"
            echo ""
            echo -e "  ${DIM}Then try:${NC}"
            echo -e "  ${YELLOW}ignite init hello && cd hello && ignite run .${NC}"
            echo ""
            ;;
        uninstall)
            do_uninstall
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            error "Unknown command: $1. Run with 'help' for usage."
            ;;
    esac
}

main "$@"
