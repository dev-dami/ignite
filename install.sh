#!/bin/bash
set -e

REPO="dev-dami/ignite"
INSTALL_DIR="${IGNITE_INSTALL_DIR:-$HOME/.ignite}"
BIN_DIR="$INSTALL_DIR/bin"
VERSION=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'
REVERSE='\033[7m'

clear_line() { echo -ne "\033[2K\r" >&2; }
move_up() { echo -ne "\033[1A" >&2; }
hide_cursor() { echo -ne "\033[?25l" >&2; }
show_cursor() { echo -ne "\033[?25h" >&2; }

print_banner() {
    clear
    echo -e "${CYAN}${BOLD}" >&2
    cat >&2 << 'EOF'
    ╦╔═╗╔╗╔╦╔╦╗╔═╗
    ║║ ╦║║║║ ║ ║╣ 
    ╩╚═╝╝╚╝╩ ╩ ╚═╝
EOF
    echo -e "${NC}" >&2
    echo -e "  ${DIM}Run JS/TS microservices in Docker${NC}" >&2
    echo "" >&2
}

print_status() {
    local installed_version latest_version status_color status_text
    
    installed_version=$(get_installed_version)
    latest_version=$(get_latest_version)
    
    echo -e "  ${DIM}─────────────────────────────────${NC}" >&2
    
    if [ -n "$installed_version" ]; then
        if [ "$installed_version" = "$latest_version" ]; then
            status_color="${GREEN}"
            status_text="Up to date"
        else
            status_color="${YELLOW}"
            status_text="Update available"
        fi
        echo -e "  ${DIM}Installed:${NC} ${BOLD}v$installed_version${NC} ${status_color}($status_text)${NC}" >&2
    else
        echo -e "  ${DIM}Installed:${NC} ${DIM}Not installed${NC}" >&2
    fi
    
    echo -e "  ${DIM}Latest:${NC}    ${BOLD}$latest_version${NC}" >&2
    echo -e "  ${DIM}─────────────────────────────────${NC}" >&2
    echo "" >&2
}

get_installed_version() {
    if [ -f "$BIN_DIR/ignite" ]; then
        "$BIN_DIR/ignite" --version 2>/dev/null || echo ""
    fi
}

get_latest_version() {
    curl -sL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/'
}

detect_platform() {
    local os arch
    case "$(uname -s)" in
        Linux*)  os="linux" ;;
        Darwin*) os="darwin" ;;
        *)       echo ""; return ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64)  arch="x64" ;;
        arm64|aarch64) arch="arm64" ;;
        *)             echo ""; return ;;
    esac
    echo "${os}-${arch}"
}

show_menu() {
    local selected=$1
    local installed_version
    installed_version=$(get_installed_version)
    
    local options=()
    
    if [ -z "$installed_version" ]; then
        options+=("Install Ignite")
    else
        options+=("Update Ignite")
        options+=("Reinstall Ignite")
        options+=("Uninstall Ignite")
    fi
    options+=("Exit")
    
    echo -e "  ${BOLD}Select an option:${NC}" >&2
    echo "" >&2
    
    for i in "${!options[@]}"; do
        if [ $i -eq $selected ]; then
            echo -e "  ${REVERSE}${CYAN} > ${options[$i]} ${NC}" >&2
        else
            echo -e "    ${DIM}${options[$i]}${NC}" >&2
        fi
    done
    
    echo "" >&2
    echo -e "  ${DIM}Use arrow keys ↑↓ and Enter to select${NC}" >&2
}

run_menu() {
    local selected=0
    local installed_version
    installed_version=$(get_installed_version)
    
    local num_options=2
    [ -n "$installed_version" ] && num_options=4
    
    # Check if we can access /dev/tty for interactive input
    if ! exec 3</dev/tty 2>/dev/null; then
        echo -e "  ${YELLOW}!${NC} Non-interactive mode detected, auto-installing..." >&2
        do_install
        return
    fi
    
    hide_cursor
    trap 'show_cursor; exec 3<&-' EXIT
    
    while true; do
        print_banner
        print_status
        show_menu $selected
        
        # Read from /dev/tty (fd 3) instead of stdin
        read -rsn1 key <&3
        
        if [[ $key == $'\x1b' ]]; then
            read -rsn2 key <&3
            case $key in
                '[A') ((selected > 0)) && ((selected--)) ;;
                '[B') ((selected < num_options - 1)) && ((selected++)) ;;
            esac
        elif [[ $key == "" ]]; then
            show_cursor
            exec 3<&-
            handle_selection $selected "$installed_version"
            return
        fi
    done
}

handle_selection() {
    local selected=$1
    local installed=$2
    
    echo "" >&2
    
    if [ -z "$installed" ]; then
        case $selected in
            0) do_install ;;
            1) echo -e "${DIM}Goodbye!${NC}" >&2; exit 0 ;;
        esac
    else
        case $selected in
            0) do_update ;;
            1) do_install --force ;;
            2) do_uninstall ;;
            3) echo -e "${DIM}Goodbye!${NC}" >&2; exit 0 ;;
        esac
    fi
}

progress_bar() {
    local current=$1
    local total=$2
    local width=40
    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r  ${CYAN}[" >&2
    printf "%${filled}s" | tr ' ' '█' >&2
    printf "%${empty}s" | tr ' ' '░' >&2
    printf "]${NC} %3d%%" "$percent" >&2
}

do_install() {
    local force=$1
    
    echo -e "  ${CYAN}${BOLD}Installing Ignite${NC}" >&2
    echo "" >&2
    
    local platform version
    platform=$(detect_platform)
    [ -z "$platform" ] && { echo -e "  ${RED}✗${NC} Unsupported platform" >&2; exit 1; }
    echo -e "  ${GREEN}✓${NC} Platform: $platform" >&2
    
    version=$(get_latest_version)
    [ -z "$version" ] && { echo -e "  ${RED}✗${NC} Could not fetch version" >&2; exit 1; }
    echo -e "  ${GREEN}✓${NC} Version: v$version" >&2
    
    local url="https://github.com/${REPO}/releases/download/v${version}/ignite-${platform}.tar.gz"
    local tmp_dir
    tmp_dir=$(mktemp -d)
    
    echo -e "  ${BLUE}>${NC} Downloading..." >&2
    
    if command -v curl &> /dev/null; then
        curl -fSL --progress-bar "$url" -o "$tmp_dir/ignite.tar.gz" 2>&1 | while read -r line; do
            :
        done
        if [ ! -f "$tmp_dir/ignite.tar.gz" ]; then
            curl -fSL "$url" -o "$tmp_dir/ignite.tar.gz" 2>/dev/null || {
                rm -rf "$tmp_dir"
                echo -e "  ${RED}✗${NC} Download failed" >&2
                exit 1
            }
        fi
    else
        wget -q "$url" -O "$tmp_dir/ignite.tar.gz" || {
            rm -rf "$tmp_dir"
            echo -e "  ${RED}✗${NC} Download failed" >&2
            exit 1
        }
    fi
    echo -e "  ${GREEN}✓${NC} Downloaded" >&2
    
    echo -e "  ${BLUE}>${NC} Extracting..." >&2
    mkdir -p "$BIN_DIR"
    tar -xzf "$tmp_dir/ignite.tar.gz" -C "$tmp_dir"
    cp "$tmp_dir/ignite-${platform}" "$BIN_DIR/ignite"
    chmod +x "$BIN_DIR/ignite"
    
    [ -d "$tmp_dir/runtime-bun" ] && { mkdir -p "$INSTALL_DIR/runtime-bun"; cp -r "$tmp_dir/runtime-bun/"* "$INSTALL_DIR/runtime-bun/" 2>/dev/null || true; }
    
    rm -rf "$tmp_dir"
    echo -e "  ${GREEN}✓${NC} Installed to $BIN_DIR/ignite" >&2
    
    setup_path
    
    echo "" >&2
    echo -e "  ${GREEN}${BOLD}✓ Installation complete!${NC}" >&2
    echo "" >&2
    echo -e "  ${DIM}Restart your terminal or run:${NC}" >&2
    echo -e "  ${YELLOW}source ~/.bashrc${NC} ${DIM}(or ~/.zshrc)${NC}" >&2
    echo "" >&2
    echo -e "  ${DIM}Then try:${NC}" >&2
    echo -e "  ${YELLOW}ignite init hello && cd hello && ignite run .${NC}" >&2
    echo "" >&2
}

do_update() {
    local installed latest
    installed=$(get_installed_version)
    latest=$(get_latest_version)
    
    if [ "$installed" = "$latest" ]; then
        echo -e "  ${GREEN}✓${NC} Already up to date (v$installed)" >&2
        echo "" >&2
        return
    fi
    
    echo -e "  ${CYAN}${BOLD}Updating Ignite${NC}" >&2
    echo -e "  ${DIM}v$installed → v$latest${NC}" >&2
    echo "" >&2
    
    do_install --force
}

do_uninstall() {
    echo -e "  ${CYAN}${BOLD}Uninstalling Ignite${NC}" >&2
    echo "" >&2
    
    if [ ! -d "$INSTALL_DIR" ]; then
        echo -e "  ${YELLOW}!${NC} Ignite is not installed" >&2
        return
    fi
    
    echo -ne "  ${YELLOW}Are you sure? [y/N]${NC} " >&2
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "  ${DIM}Cancelled${NC}" >&2
        return
    fi
    
    rm -rf "$INSTALL_DIR"
    echo -e "  ${GREEN}✓${NC} Removed $INSTALL_DIR" >&2
    
    echo "" >&2
    echo -e "  ${DIM}You may want to remove the PATH entry from your shell config${NC}" >&2
    echo "" >&2
}

setup_path() {
    local shell_rc path_export
    path_export="export PATH=\"\$PATH:$BIN_DIR\""
    
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
    
    if echo "$PATH" | grep -q "$BIN_DIR"; then
        return
    fi
    
    if [ -n "$shell_rc" ]; then
        if ! grep -q "$BIN_DIR" "$shell_rc" 2>/dev/null; then
            echo -e "\n# Ignite CLI\n$path_export" >> "$shell_rc"
            echo -e "  ${GREEN}✓${NC} Added to PATH in $(basename "$shell_rc")" >&2
        fi
    fi
}

show_help() {
    echo "Ignite Installer" >&2
    echo "" >&2
    echo "Usage: install.sh [command]" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  install    Install Ignite (default)" >&2
    echo "  update     Update to latest version" >&2
    echo "  uninstall  Remove Ignite" >&2
    echo "  help       Show this help" >&2
    echo "" >&2
    echo "Examples:" >&2
    echo "  curl -fsSL .../install.sh | bash" >&2
    echo "  curl -fsSL .../install.sh | bash -s install" >&2
    echo "  curl -fsSL .../install.sh | bash -s update" >&2
    echo "" >&2
}

main() {
    case "${1:-}" in
        install)
            print_banner
            print_status
            do_install
            ;;
        update)
            print_banner
            print_status
            do_update
            ;;
        uninstall)
            print_banner
            do_uninstall
            ;;
        help|--help|-h)
            show_help
            ;;
        "")
            if [ -t 0 ] && [ -t 1 ]; then
                run_menu
            else
                print_banner
                print_status
                do_install
            fi
            ;;
        *)
            echo "Unknown command: $1" >&2
            show_help
            exit 1
            ;;
    esac
}

main "$@"
