#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GPT Image Playground - 129 生产部署脚本
#
# 部署目标: 129 线上生产服务器
# 域名: img-playground.anzz.site
# 部署方式: 本地构建 + 流式上传 + 远程 npm ci + PM2 托管
# ============================================================

# ------------------- 可配置项 -------------------
SERVER_IP="159.75.70.129"
SERVER_USER="root"
SERVER_PORT="22"
REMOTE_DIR="/root/work/gpt-image-playground"
DOMAIN="img-playground.anzz.site"
NODE_PORT="3000"
CADDY_FILE="/etc/caddy/Caddyfile"
APP_NAME="gpt-image-playground"
PM2_LOG_DIR="/var/log/gpt-image-playground"
SSH_PROXY="${SSH_PROXY:-}"
# ------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✅  $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️   $1${NC}"; }
err()  { echo -e "${RED}  ❌  $1${NC}" >&2; }
step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE} 📦  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ---------- 参数解析 ----------
SHOW_ENV=false
OPENAI_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
APP_PASSWORD=""
UMAMI_SCRIPT_URL="${UMAMI_SCRIPT_URL:-}"
UMAMI_WEBSITE_ID="${UMAMI_WEBSITE_ID:-}"
BUILD_ONLY=false
INSTALL_PM2=false
SETUP_PM2_STARTUP=false
LOCAL_ENV_FILE=".env.production"
USING_LOCAL_ENV_FILE=false
KNOWN_BUILD_ENV_KEYS=(
    OPENAI_API_KEY
    OPENAI_API_BASE_URL
    GEMINI_API_KEY
    GEMINI_API_BASE_URL
    POLISHING_API_KEY
    POLISHING_API_BASE_URL
    POLISHING_MODEL_ID
    POLISHING_PROMPT
    POLISHING_THINKING_ENABLED
    POLISHING_THINKING_EFFORT
    POLISHING_THINKING_EFFORT_FORMAT
    APP_PASSWORD
    NEXT_PUBLIC_IMAGE_STORAGE_MODE
    CLIENT_DIRECT_LINK_PRIORITY
    NEXT_PUBLIC_CLIENT_DIRECT_LINK_PRIORITY
    VERCEL
    NEXT_PUBLIC_VERCEL_ENV
    UMAMI_SCRIPT_URL
    UMAMI_WEBSITE_ID
)

usage() {
    cat <<EOF
用法: $0 [选项]

选项:
  -k, --key KEY          无本地 .env.production 时设置 OPENAI_API_KEY
  -b, --base-url URL     无本地 .env.production 时设置 OPENAI_API_BASE_URL (默认: https://api.openai.com/v1)
  -p, --password PWD     无本地 .env.production 时设置 APP_PASSWORD（访问密码，留空则不启用）
  --umami-script-url URL 无本地 .env.production 时设置 UMAMI_SCRIPT_URL
  --umami-website-id ID  无本地 .env.production 时设置 UMAMI_WEBSITE_ID
  --proxy HOST:PORT      通过 SOCKS5 代理执行 SSH（如 127.0.0.1:7890）
  --install-pm2          如果远程服务器未安装 PM2，则通过 npm 全局安装
  --pm2-startup          执行 pm2 startup，让服务器重启后自动拉起服务
  -e, --env              仅显示服务器 .env 的键名（值会被隐藏）后退出
  --build                仅使用/生成 .env.production 并本地构建验证，不部署
  -h, --help             显示帮助信息

示例:
  $0                                      # 默认部署（无 Key，官方 API）
  $0 -k sk-xxx --base-url http://proxy/v1  # 自定义 Key 和 API 地址
  $0 --install-pm2 --pm2-startup          # 首次使用 PM2 托管时执行
  $0 --proxy 127.0.0.1:7890               # 通过本地 SOCKS5 代理部署
  SSH_PROXY=127.0.0.1:7890 $0             # 等价的环境变量用法
  $0 -p mypassword                        # 启用访问密码保护
  $0 --umami-script-url https://msc.anzz.site/script.js --umami-website-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  $0 -e                                   # 查看服务器当前 .env 键名
EOF
    exit 0
}

need_arg() {
    local opt="$1"
    local value="${2:-}"
    if [ -z "$value" ] || [[ "$value" == -* ]]; then
        err "$opt 需要一个值"
        usage
    fi
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        -k|--key)
            need_arg "$1" "${2:-}"
            OPENAI_KEY="$2"
            shift 2
            ;;
        -b|--base-url)
            need_arg "$1" "${2:-}"
            OPENAI_BASE_URL="$2"
            shift 2
            ;;
        -p|--password)
            need_arg "$1" "${2:-}"
            APP_PASSWORD="$2"
            shift 2
            ;;
        --umami-script-url)
            need_arg "$1" "${2:-}"
            UMAMI_SCRIPT_URL="$2"
            shift 2
            ;;
        --umami-website-id)
            need_arg "$1" "${2:-}"
            UMAMI_WEBSITE_ID="$2"
            shift 2
            ;;
        --proxy)
            need_arg "$1" "${2:-}"
            SSH_PROXY="$2"
            shift 2
            ;;
        --install-pm2)
            INSTALL_PM2=true
            shift
            ;;
        --pm2-startup)
            SETUP_PM2_STARTUP=true
            shift
            ;;
        -e|--env)
            SHOW_ENV=true
            shift
            ;;
        --build)
            BUILD_ONLY=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            err "未知参数: $1"
            usage
            ;;
    esac
done

SSH_COMMON_ARGS=(-p "$SERVER_PORT" -o ConnectTimeout=30 -o ServerAliveInterval=30 -o ServerAliveCountMax=3)
if [ -n "$SSH_PROXY" ]; then
    if [[ ! "$SSH_PROXY" =~ ^[A-Za-z0-9._:-]+$ ]]; then
        err "SSH 代理地址只能包含字母、数字、点、下划线、冒号和短横线"
        exit 1
    fi
    SSH_COMMON_ARGS+=(-o "ProxyCommand=/usr/bin/nc -X 5 -x $SSH_PROXY %h %p")
    log "使用 SOCKS5 代理: $SSH_PROXY"
fi

remote_ssh() {
    ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "$@"
}

remote_bash() {
    remote_ssh "bash -seuo pipefail"
}

remote_node_shell() {
    cat <<'EOF'
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$NVM_DIR/nvm.sh"
fi
nvm install 20 >/dev/null
nvm use 20 >/dev/null
export PATH="$HOME/.local/bin:$PATH"
EOF
}

redact_env_content() {
    while IFS= read -r line; do
        if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
            printf '%s=<redacted>\n' "${line%%=*}"
        fi
    done
}

dotenv_quote() {
    local value="$1"
    if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
        err "环境变量值不能包含换行"
        exit 1
    fi

    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\$/\\\$}"
    printf '"%s"' "$value"
}

read_dotenv_value() {
    local file="$1"
    local key="$2"

    if [ ! -f "$file" ]; then
        return 0
    fi

    node - "$file" "$key" <<'NODE'
const fs = require('fs');
const [file, key] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match || match[1] !== key) continue;

  let value = match[2].trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
    if (quote === '"') {
      value = value.replace(/\\(["\\$])/g, '$1');
    }
  } else {
    const commentIndex = value.search(/\s#/);
    if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
  }

  process.stdout.write(value);
  process.exit(0);
}
NODE
}

validate_supported_dotenv_syntax() {
    local file="$1"

    if ! node - "$file" <<'NODE'
const fs = require('fs');
const [file] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

const fail = (lineNumber, message) => {
  console.error(`${file}:${lineNumber}: ${message}`);
  process.exitCode = 1;
};

lines.forEach((line, index) => {
  const lineNumber = index + 1;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  if (/^export\s+/.test(trimmed)) {
    fail(lineNumber, '不支持 export KEY=value 语法，请改成 KEY=value');
    return;
  }

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) {
    fail(lineNumber, '不支持的 dotenv 行格式，仅支持 KEY=value');
    return;
  }

  const value = match[2].trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && !value.endsWith(quote)) {
    fail(lineNumber, '不支持多行或未闭合引号的 dotenv 值');
  }

  if (/(^|[^\\])\$\{?[A-Za-z_][A-Za-z0-9_]*(?:[}:][^}]*)?\}?/.test(value)) {
    fail(lineNumber, '不支持变量展开语法，请在 .env.production 中写入最终值');
  }
});
NODE
    then
        err "$file 使用了部署脚本不支持的 dotenv 高级语法"
        exit 1
    fi
}

load_umami_from_existing_env() {
    local env_file="$LOCAL_ENV_FILE"

    if [ -z "$UMAMI_SCRIPT_URL" ]; then
        UMAMI_SCRIPT_URL="$(read_dotenv_value "$env_file" "UMAMI_SCRIPT_URL")"
    fi
    if [ -z "$UMAMI_WEBSITE_ID" ]; then
        UMAMI_WEBSITE_ID="$(read_dotenv_value "$env_file" "UMAMI_WEBSITE_ID")"
    fi
}

load_status_from_env_file() {
    local env_file="$1"

    OPENAI_KEY="$(read_dotenv_value "$env_file" "OPENAI_API_KEY")"
    APP_PASSWORD="$(read_dotenv_value "$env_file" "APP_PASSWORD")"
    UMAMI_SCRIPT_URL="$(read_dotenv_value "$env_file" "UMAMI_SCRIPT_URL")"
    UMAMI_WEBSITE_ID="$(read_dotenv_value "$env_file" "UMAMI_WEBSITE_ID")"
}

validate_umami_config() {
    if { [ -n "$UMAMI_SCRIPT_URL" ] && [ -z "$UMAMI_WEBSITE_ID" ]; } || { [ -z "$UMAMI_SCRIPT_URL" ] && [ -n "$UMAMI_WEBSITE_ID" ]; }; then
        err "UMAMI_SCRIPT_URL 和 UMAMI_WEBSITE_ID 必须同时设置，或同时留空"
        exit 1
    fi
}

ensure_remote_compiler() {
    if remote_ssh 'command -v clang++-13 >/dev/null 2>&1'; then
        return 0
    fi

    warn "远程缺少 clang-13，开始通过 apt 安装"
    remote_ssh 'DEBIAN_FRONTEND=noninteractive apt-get install -y clang-13'
    ok "clang-13 安装完成"
}

secret_env_value() {
    local key="$1"
    local value=""

    value="$(read_dotenv_value ".env.local" "$key")"
    if [ -z "$value" ]; then
        value="${!key:-}"
    fi

    printf '%s' "$value"
}

export_secret_env_values() {
    local key value

    for key in BETTER_AUTH_SECRET ADMIN_BOOTSTRAP_SECRET; do
        value="$(secret_env_value "$key")"
        if [ -n "$value" ]; then
            export "$key=$value"
        fi
    done
}

write_env_key() {
    local file="$1"
    local key="$2"
    local raw_value="$3"
    local quoted_value

    quoted_value="$(dotenv_quote "$raw_value")"

    node - "$file" "$key" "$quoted_value" <<'NODE'
const fs = require('fs');
const [file, key, quotedValue] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const keyPattern = new RegExp(`^${key}\\s*=`);
let replaced = false;

for (let i = 0; i < lines.length; i++) {
  if (keyPattern.test(lines[i])) {
    lines[i] = `${key}=${quotedValue}`;
    replaced = true;
    break;
  }
}

if (!replaced) lines.push(`${key}=${quotedValue}`);

let text = lines.join('\n');
if (!text.endsWith('\n')) text += '\n';
fs.writeFileSync(file, text);
NODE
}

build_remote_env_file() {
    DEPLOY_ENV_FILE="$(mktemp /tmp/gpt-image-playground-env.XXXXXX)"
    cp "$LOCAL_ENV_FILE" "$DEPLOY_ENV_FILE"

    local key value
    for key in BETTER_AUTH_SECRET ADMIN_BOOTSTRAP_SECRET; do
        value="$(secret_env_value "$key")"
        if [ -n "$value" ] && [ -z "$(read_dotenv_value "$DEPLOY_ENV_FILE" "$key")" ]; then
            write_env_key "$DEPLOY_ENV_FILE" "$key" "$value"
        fi
    done
}

generate_env() {
    ENV_CONTENT=""
    if [ -n "$OPENAI_KEY" ]; then
        ENV_CONTENT+="OPENAI_API_KEY=$(dotenv_quote "$OPENAI_KEY")"$'\n'
    fi
    ENV_CONTENT+="OPENAI_API_BASE_URL=$(dotenv_quote "$OPENAI_BASE_URL")"$'\n'
    ENV_CONTENT+="NEXT_PUBLIC_IMAGE_STORAGE_MODE=$(dotenv_quote "indexeddb")"$'\n'
    ENV_CONTENT+="CLIENT_DIRECT_LINK_PRIORITY=$(dotenv_quote "true")"$'\n'

    if [ -n "$APP_PASSWORD" ]; then
        ENV_CONTENT+="APP_PASSWORD=$(dotenv_quote "$APP_PASSWORD")"$'\n'
    fi

    if [ -n "$UMAMI_SCRIPT_URL" ]; then
        ENV_CONTENT+="UMAMI_SCRIPT_URL=$(dotenv_quote "$UMAMI_SCRIPT_URL")"$'\n'
        ENV_CONTENT+="UMAMI_WEBSITE_ID=$(dotenv_quote "$UMAMI_WEBSITE_ID")"$'\n'
    fi
}

export_env_file_for_build() {
    local key value

    for key in "${KNOWN_BUILD_ENV_KEYS[@]}"; do
        value="$(read_dotenv_value "$LOCAL_ENV_FILE" "$key")"
        export "$key=$value"
    done

    while IFS= read -r -d '' key && IFS= read -r -d '' value; do
        export "$key=$value"
    done < <(node - "$LOCAL_ENV_FILE" <<'NODE'
const fs = require('fs');
const [file] = process.argv.slice(2);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) continue;

  let value = match[2].trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
    if (quote === '"') {
      value = value.replace(/\\(["\\$])/g, '$1');
    }
  } else {
    const commentIndex = value.search(/\s#/);
    if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
  }

  process.stdout.write(match[1]);
  process.stdout.write('\0');
  process.stdout.write(value);
  process.stdout.write('\0');
}
NODE
    )
}

prepare_env_file() {
    if [ -f "$LOCAL_ENV_FILE" ]; then
        USING_LOCAL_ENV_FILE=true
        if [ ! -r "$LOCAL_ENV_FILE" ]; then
            err "本地 $LOCAL_ENV_FILE 不可读"
            exit 1
        fi

        validate_supported_dotenv_syntax "$LOCAL_ENV_FILE"
        load_status_from_env_file "$LOCAL_ENV_FILE"
        validate_umami_config
        log "使用现有 $LOCAL_ENV_FILE 作为唯一环境配置（不会重新生成）:"
        redact_env_content < "$LOCAL_ENV_FILE"
        ok "将按本地 $LOCAL_ENV_FILE 构建，并直接同步到远程 .env"
        return 0
    fi

    USING_LOCAL_ENV_FILE=false
    load_umami_from_existing_env
    validate_umami_config
    generate_env
    log "未找到 $LOCAL_ENV_FILE，按参数生成兜底配置（值已隐藏）:"
    printf '%s' "$ENV_CONTENT" | redact_env_content
    printf '%s' "$ENV_CONTENT" > "$LOCAL_ENV_FILE"
    chmod 600 "$LOCAL_ENV_FILE"
    ok "$LOCAL_ENV_FILE 已生成"
}

tar_supports() {
    tar --help 2>&1 | grep -q -- "$1"
}

build_tar_command() {
    TAR_CREATE_ARGS=(czf -)
    if tar_supports '--no-xattrs'; then
        TAR_CREATE_ARGS+=(--no-xattrs)
    fi
    if tar_supports '--disable-copyfile'; then
        TAR_CREATE_ARGS+=(--disable-copyfile)
    fi

    TAR_EXCLUDES=(
        # Keep .next/node_modules: Turbopack stores server external package aliases there.
        --exclude='./node_modules'
        --exclude='./.git'
        --exclude='./generated-images'
        --exclude='./.env'
        --exclude='./.env.local'
        --exclude='./.env.production'
        --exclude='./.DS_Store'
        --exclude='._*'
        --exclude='./.vercel'
        --exclude='./coverage'
        --exclude='./build'
        --exclude='./out'
        --exclude='./src-tauri'
        --exclude='./.playwright-cli'
        --exclude='./.playwright-mcp'
        --exclude='./tmp-qa'
        --exclude='./test-results'
        --exclude='./tmp'
        --exclude='*.tsbuildinfo'
        --exclude='./readme-images'
        --exclude='./.github'
        --exclude='./LICENSE'
        --exclude='./CHANGELOG.md'
        --exclude='./docker-compose.yml'
        --exclude='./Dockerfile'
        --exclude='./.env.example'
    )
}

wait_for_http() {
    local url="$1"
    local label="$2"
    local attempts="${3:-30}"
    local delay="${4:-2}"
    local code="000"

    for ((i = 1; i <= attempts; i++)); do
        code=$(remote_ssh "curl -sS -o /dev/null -w '%{http_code}' '$url' --max-time 8 2>/dev/null || true")
        if [[ "$code" == "200" || "$code" == "301" || "$code" == "302" || "$code" == "307" || "$code" == "308" ]]; then
            ok "$label 正常 (HTTP $code)"
            return 0
        fi
        sleep "$delay"
    done

    err "$label 未就绪 (最后 HTTP $code)"
    return 1
}

if $SHOW_ENV; then
    step "查看服务器 .env 配置（隐藏值）"
    remote_ssh "
    if [ -f '$REMOTE_DIR/.env' ]; then
        while IFS='=' read -r key _; do
            case \"\$key\" in
                ''|'#'*) continue ;;
                *) printf '%s=<redacted>\\n' \"\$key\" ;;
            esac
        done < '$REMOTE_DIR/.env'
    else
        echo '未找到 .env 文件'
    fi
    "
    exit 0
fi

# ========== Step 0: 本地环境检查 ==========
step "Step 0: 本地环境检查"

if [ ! -f "package.json" ]; then
    err "请在项目根目录执行此脚本"
    exit 1
fi

for required_cmd in ssh tar npm node; do
    if ! command -v "$required_cmd" >/dev/null 2>&1; then
        err "本地未找到 $required_cmd 命令"
        exit 1
    fi
done
ok "本地基础命令正常"

LOCAL_VERSION=$(node -p "require('./package.json').version")
log "本地版本: v$LOCAL_VERSION"

# ========== Step 1: 准备 .env.production 并本地构建 ==========
step "Step 1: 准备 .env.production 并本地构建"

prepare_env_file

if $USING_LOCAL_ENV_FILE; then
    export_env_file_for_build
else
    export OPENAI_API_BASE_URL="$OPENAI_BASE_URL"
    export NEXT_PUBLIC_IMAGE_STORAGE_MODE="indexeddb"
    export CLIENT_DIRECT_LINK_PRIORITY="true"
    if [ -n "$OPENAI_KEY" ]; then
        export OPENAI_API_KEY="$OPENAI_KEY"
    else
        unset OPENAI_API_KEY || true
    fi
    if [ -n "$APP_PASSWORD" ]; then
        export APP_PASSWORD="$APP_PASSWORD"
    else
        unset APP_PASSWORD || true
    fi
    if [ -n "$UMAMI_SCRIPT_URL" ]; then
        export UMAMI_SCRIPT_URL="$UMAMI_SCRIPT_URL"
        export UMAMI_WEBSITE_ID="$UMAMI_WEBSITE_ID"
    else
        unset UMAMI_SCRIPT_URL || true
        unset UMAMI_WEBSITE_ID || true
    fi
fi

export_secret_env_values

log "执行 npm run build..."
npm run build
ok "本地构建通过"

if $BUILD_ONLY; then
    ok "仅构建模式，退出"
    exit 0
fi

if [ ! -d ".next" ]; then
    err "构建产物 .next/ 不存在，请先执行 npm run build"
    exit 1
fi

# ========== Step 2: 远程环境检查 ==========
step "Step 2: 远程环境检查（129 服务器）"

if ! remote_ssh 'uname -n' >/dev/null 2>&1; then
    err "无法连接服务器 ($SERVER_IP)"
    exit 1
fi
ok "服务器连接正常"

if ! remote_ssh "$(remote_node_shell); command -v node >/dev/null && command -v npm >/dev/null"; then
    err "服务器上未找到 Node.js/npm（nvm 可能未初始化）"
    exit 1
fi

REMOTE_NODE_VERSION=$(remote_ssh "$(remote_node_shell); node -v")
REMOTE_NODE_MAJOR=$(remote_ssh "$(remote_node_shell); node -p \"process.versions.node.split('.')[0]\"")
REMOTE_NODE_BIN=$(remote_ssh "$(remote_node_shell); command -v node")
log "远程 Node.js 版本: $REMOTE_NODE_VERSION"

if [ "$REMOTE_NODE_MAJOR" -lt 20 ]; then
    err "Node.js 版本过低，需要 >= 20.0.0"
    exit 1
fi

if ! remote_ssh "$(remote_node_shell); command -v pm2 >/dev/null"; then
    if $INSTALL_PM2; then
        warn "远程未找到 PM2，开始通过 npm install -g pm2 安装"
        remote_ssh "$(remote_node_shell); npm install -g pm2"
        ok "PM2 安装完成"
    else
        err "远程未安装 PM2。首次部署请先运行: $0 --install-pm2 --pm2-startup"
        exit 1
    fi
fi
PM2_VERSION=$(remote_ssh "$(remote_node_shell); pm2 -v")
log "远程 PM2 版本: $PM2_VERSION"

# ========== Step 3: 上传构建产物至服务器 ==========
step "Step 3: 上传构建产物至服务器"

build_tar_command
log "使用单一路径流式 tar over SSH 上传，避免 SCP 后未解压的问题"

COPYFILE_DISABLE=1 tar "${TAR_CREATE_ARGS[@]}" "${TAR_EXCLUDES[@]}" . | remote_ssh \
    "mkdir -p '$REMOTE_DIR' && rm -rf '$REMOTE_DIR/.next' && tar --warning=no-unknown-keyword -xzf - -C '$REMOTE_DIR' && find '$REMOTE_DIR' \( -name '._*' -o -name '.DS_Store' \) -delete"
if [ -d ".next/node_modules" ]; then
    COPYFILE_DISABLE=1 tar czf - .next/node_modules | remote_ssh \
        "mkdir -p '$REMOTE_DIR/.next' && rm -rf '$REMOTE_DIR/.next/node_modules' && tar --warning=no-unknown-keyword -xzf - -C '$REMOTE_DIR'"
fi
ok "源码与构建产物上传完成"

build_remote_env_file
remote_ssh "umask 077 && mkdir -p '$REMOTE_DIR' && cat > '$REMOTE_DIR/.env'" < "$DEPLOY_ENV_FILE"
rm -f "$DEPLOY_ENV_FILE"
ok "本地 $LOCAL_ENV_FILE 已同步为远程 .env（权限 600）"

REMOTE_VERSION=$(remote_ssh "$(remote_node_shell); cd '$REMOTE_DIR' && node -p \"require('./package.json').version\"")
if [ "$REMOTE_VERSION" != "$LOCAL_VERSION" ]; then
    err "远程版本不一致: local=$LOCAL_VERSION remote=$REMOTE_VERSION"
    exit 1
fi
ok "远程版本已更新: v$REMOTE_VERSION"

# ========== Step 4: 安装生产依赖 ==========
step "Step 4: 安装生产依赖"

remote_bash <<EOF
set -euo pipefail
$(remote_node_shell)
cd '$REMOTE_DIR'
LOCK_HASH=\$(node -e "const crypto=require('crypto'); const fs=require('fs'); process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex'))")
if [ -f .deploy-package-lock.sha256 ] && [ "\$(cat .deploy-package-lock.sha256)" = "\$LOCK_HASH" ] && [ -f node_modules/next/dist/bin/next ] && [ -f node_modules/better-sqlite3/build/Release/better_sqlite3.node ]; then
    echo 'package-lock 未变化且生产依赖完整，跳过 npm ci'
else
    npm_config_jobs=1 npm ci --omit=dev --no-audit --no-fund --ignore-scripts
    printf '%s' "\$LOCK_HASH" > .deploy-package-lock.sha256
fi
if [ -f node_modules/better-sqlite3/binding.gyp ]; then
    node - <<'NODE'
const fs = require('fs');
const file = 'node_modules/better-sqlite3/binding.gyp';
const source = fs.readFileSync(file, 'utf8');
const updated = source.replace(/-std=c\+\+20/g, '-std=c++2a');
if (updated !== source) fs.writeFileSync(file, updated);
NODE
fi
npm_config_jobs=1 npm rebuild better-sqlite3 --build-from-source --no-audit --no-fund
test -f node_modules/next/dist/bin/next
test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node
node -e "const p=require('./package.json'); console.log('remote package:', p.name + '@' + p.version)"
EOF
ok "生产依赖安装完成，Next.js 启动文件已确认存在"

# ========== Step 5: 配置 Caddy ==========
step "Step 5: 配置 Caddy 反向代理"

remote_bash <<EOF
set -euo pipefail
mkdir -p /var/log/caddy/img-playground
chown -R caddy:caddy /var/log/caddy/img-playground 2>/dev/null || chmod 755 /var/log/caddy/img-playground

if ! grep -q '$DOMAIN' '$CADDY_FILE'; then
    backup='$CADDY_FILE.bak.'\$(date +%Y%m%d%H%M%S)
    cp '$CADDY_FILE' "\$backup"
    cat >> '$CADDY_FILE' <<'CADDY_EOF'

$DOMAIN {
    @html path /
    reverse_proxy @html 127.0.0.1:$NODE_PORT {
        header_down Cache-Control "no-cache, no-store, must-revalidate"
        header_down Pragma "no-cache"
        header_down Expires "0"
    }
    reverse_proxy 127.0.0.1:$NODE_PORT
    import compress
    import site-log img-playground
}
CADDY_EOF
    if caddy validate --config '$CADDY_FILE'; then
        systemctl reload caddy
        echo 'CADDY_ADDED_AND_RELOADED'
    else
        cp "\$backup" '$CADDY_FILE'
        systemctl reload caddy || systemctl restart caddy
        echo 'CADDY_ROLLED_BACK'
        exit 1
    fi
else
    if ! awk '/^$DOMAIN \\{/{flag=1} flag && /header_down Cache-Control "no-cache, no-store, must-revalidate"/{found=1} flag && /^}/{flag=0} END{exit found ? 0 : 1}' '$CADDY_FILE'; then
        backup='$CADDY_FILE.bak.'\$(date +%Y%m%d%H%M%S)
        cp '$CADDY_FILE' "\$backup"
        python3 - <<'PY'
from pathlib import Path

caddy_file = Path('$CADDY_FILE')
domain = '$DOMAIN'
insert = [
    '    @html path /',
    '    reverse_proxy @html 127.0.0.1:$NODE_PORT {',
    '        header_down Cache-Control "no-cache, no-store, must-revalidate"',
    '        header_down Pragma "no-cache"',
    '        header_down Expires "0"',
    '    }',
]
lines = caddy_file.read_text().splitlines()
out = []
inside = False
inserted = False
for line in lines:
    out.append(line)
    if line.strip() == f'{domain} {{':
        inside = True
        continue
    if inside and line.strip().startswith('reverse_proxy') and not inserted:
        out.pop()
        out.extend(insert)
        out.append(line)
        inserted = True
    if inside and line.strip() == '}':
        inside = False

if inserted:
    caddy_file.write_text('\n'.join(out) + '\n')
PY
    fi
    caddy validate --config '$CADDY_FILE'
    if ! systemctl is-active caddy >/dev/null 2>&1; then
        systemctl start caddy
    fi
    systemctl reload caddy
    echo 'CADDY_ALREADY_EXISTS'
fi
EOF
ok "Caddy 配置检查完成"

# ========== Step 6: 使用 PM2 启动/重载服务 ==========
step "Step 6: 使用 PM2 启动/重载 Node.js 服务"

remote_bash <<EOF
set -euo pipefail
$(remote_node_shell)
cd '$REMOTE_DIR'
mkdir -p '$PM2_LOG_DIR'
chmod 755 '$PM2_LOG_DIR'

cat > ecosystem.config.cjs <<'PM2_EOF'
module.exports = {
  apps: [
    {
        name: '$APP_NAME',
        cwd: '$REMOTE_DIR',
        script: 'node_modules/next/dist/bin/next',
        args: 'start -H 127.0.0.1 -p $NODE_PORT',
        interpreter: '$REMOTE_NODE_BIN',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '$NODE_PORT',
        HOSTNAME: '127.0.0.1',
      },
      max_memory_restart: '512M',
      out_file: '$PM2_LOG_DIR/out.log',
      error_file: '$PM2_LOG_DIR/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
PM2_EOF

if pm2 describe '$APP_NAME' >/dev/null 2>&1; then
    pm2 startOrReload ecosystem.config.cjs --only '$APP_NAME' --update-env
else
    if ss -ltn "sport = :${NODE_PORT}" 2>/dev/null | grep -q LISTEN; then
        echo '发现非 PM2 旧进程占用 ${NODE_PORT}，尝试清理 legacy listener'
        if command -v fuser >/dev/null 2>&1; then
            fuser -k '${NODE_PORT}/tcp' || true
            sleep 2
        else
            echo '缺少 fuser，无法安全清理旧进程'
            exit 1
        fi
    fi
    pm2 start ecosystem.config.cjs --only '$APP_NAME' --update-env
fi

pm2 save

if $SETUP_PM2_STARTUP; then
    pm2 startup systemd -u ${SERVER_USER} --hp "\$HOME" || true
    pm2 save
fi

STATUS=\$(pm2 jlist | node -e "let data=''; process.stdin.on('data', d => data += d); process.stdin.on('end', () => { const start = data.indexOf('['); const end = data.lastIndexOf(']'); if (start === -1 || end === -1 || end < start) { console.error(data.trim()); process.exit(1); } try { const apps = JSON.parse(data.slice(start, end + 1)); const app = apps.find(item => item.name === process.argv[1]); console.log(app?.pm2_env?.status || 'missing'); } catch (error) { console.error(error.message); console.error(data.trim()); process.exit(1); } });" '$APP_NAME')
if [ "\$STATUS" != 'online' ]; then
    pm2 logs '$APP_NAME' --nostream --lines 50 || true
    echo "PM2 status is \$STATUS"
    exit 1
fi

pm2 describe '$APP_NAME' | sed -n '1,40p'
EOF
ok "PM2 服务已上线"

# ========== Step 7: 验证 HTTP/HTTPS ==========
step "Step 7: 验证服务"

if ! wait_for_http "http://127.0.0.1:$NODE_PORT/" "本地服务" 30 2; then
    remote_ssh "$(remote_node_shell); pm2 logs '$APP_NAME' --nostream --lines 80 || true"
    exit 1
fi

if ! wait_for_http "https://$DOMAIN/" "HTTPS 访问" 30 2; then
    warn "HTTPS 验证失败，请检查 Caddy 日志: journalctl -u caddy -n 80 --no-pager"
    exit 1
fi

# ========== Step 8: 资源监控 ==========
step "Step 8: 资源占用监控"

remote_bash <<EOF
set -euo pipefail
$(remote_node_shell)
echo '=== PM2 ==='
pm2 status '$APP_NAME'
echo ''
echo '=== 内存使用 ==='
free -h | grep -E '^(Mem|Swap)'
echo ''
echo '=== 磁盘使用 ==='
df -h / | tail -1
echo ''
echo '=== 项目目录大小 ==='
du -sh '$REMOTE_DIR' 2>/dev/null || true
du -sh '$REMOTE_DIR/node_modules' '$REMOTE_DIR/.next' 2>/dev/null || true
echo ''
echo '=== Caddy ==='
systemctl is-active caddy
EOF

# ========== Step 9: 部署完成 ==========
step "部署完成"

echo -e "  ${GREEN}域名:   ${NC}https://$DOMAIN"
echo -e "  ${GREEN}版本:   ${NC}v$LOCAL_VERSION"
echo -e "  ${GREEN}源码:   ${NC}$REMOTE_DIR"
echo -e "  ${GREEN}端口:   ${NC}127.0.0.1:$NODE_PORT"
echo -e "  ${GREEN}进程:   ${NC}PM2 app '$APP_NAME'"
echo -e "  ${GREEN}Caddy:  ${NC}已验证配置，必要时 reload"

if [ -n "$OPENAI_KEY" ]; then
    echo -e "  ${YELLOW}API Key:  ${NC}已在远程 .env 中设置"
    warn "生产环境不要将 Key 提交到版本控制；本脚本已排除 .env.production 的 tar 上传"
else
    echo -e "  ${YELLOW}API Key:  ${NC}未设置 — 用户需通过 UI ⚙️ 系统设置面板自行配置"
fi

if [ -n "$UMAMI_SCRIPT_URL" ]; then
    echo -e "  ${GREEN}Umami:   ${NC}已启用"
else
    echo -e "  ${YELLOW}Umami:   ${NC}未配置"
fi

echo ""
log "常用命令:"
echo "  PM2 状态:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"pm2 status $APP_NAME\""
echo "  PM2 日志:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"pm2 logs $APP_NAME --lines 100\""
echo "  重载服务:   ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"cd $REMOTE_DIR && pm2 startOrReload ecosystem.config.cjs --only $APP_NAME --update-env\""
echo "  Caddy 日志: ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"journalctl -u caddy -n 80 --no-pager\""
echo "  查看配置:   $0 -e"
