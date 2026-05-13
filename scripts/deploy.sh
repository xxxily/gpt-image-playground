#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GPT Image Playground - 一键部署脚本
# 部署目标: 142 Oracle Cloud ARM64 服务器
# 域名: img-playground.ora.anzz.top
# ============================================================

# ------------------- 可配置项 -------------------
SERVER_IP="146.56.184.142"
SERVER_USER="ubuntu"
REMOTE_DIR="/home/ubuntu/github/gpt-image-playground"
DOMAIN="img-playground.ora.anzz.top"
CONTAINER_PORT="14000"
HOST_PORT="3000"
CADDY_FILE="/etc/caddy/Caddyfile"
SSH_PROXY="${SSH_PROXY:-}"
# ------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()    { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()     { echo -e "${GREEN}  ✅  $1${NC}"; }
warn()   { echo -e "${YELLOW}  ⚠️   $1${NC}"; }
err()    { echo -e "${RED}  ❌  $1${NC}" >&2; }
step()   { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE} 📦  $1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ---------- 参数解析 ----------
SHOW_ENV=false
OPENAI_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
APP_PASSWORD=""
UMAMI_SCRIPT_URL="${UMAMI_SCRIPT_URL:-}"
UMAMI_WEBSITE_ID="${UMAMI_WEBSITE_ID:-}"
BUILD_ONLY=false
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
  -k, --key KEY         无本地 .env.production 时设置 OPENAI_API_KEY
  -b, --base-url URL    无本地 .env.production 时设置 OPENAI_API_BASE_URL (默认: https://api.openai.com/v1)
  -p, --password PWD    无本地 .env.production 时设置 APP_PASSWORD（访问密码，留空则不启用）
  --umami-script-url URL 无本地 .env.production 时设置 UMAMI_SCRIPT_URL
  --umami-website-id ID  无本地 .env.production 时设置 UMAMI_WEBSITE_ID
  --proxy HOST:PORT     通过 SOCKS5 代理执行 SSH/SCP（如 127.0.0.1:7890）
  -e, --env             仅显示当前服务器上的 .env 配置后退出
  --build               仅本地构建验证，不部署
  -h, --help            显示帮助信息

示例:
  $0                                      # 默认部署（无 Key，官方 API）
  $0 -k sk-xxx --base-url http://proxy/v1  # 自定义 Key 和 API 地址
  $0 --proxy 127.0.0.1:7890               # 通过本地 SOCKS5 代理部署
  SSH_PROXY=127.0.0.1:7890 $0             # 等价的环境变量用法
  $0 -p mypassword                        # 启用访问密码保护
  $0 --umami-script-url https://msc.anzz.site/script.js --umami-website-id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  $0 -e                                   # 查看服务器当前 .env
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
    case $1 in
        -k|--key)       need_arg "$1" "${2:-}"; OPENAI_KEY="$2"; shift 2 ;;
        -b|--base-url)  need_arg "$1" "${2:-}"; OPENAI_BASE_URL="$2"; shift 2 ;;
        -p|--password)  need_arg "$1" "${2:-}"; APP_PASSWORD="$2"; shift 2 ;;
        --umami-script-url) need_arg "$1" "${2:-}"; UMAMI_SCRIPT_URL="$2"; shift 2 ;;
        --umami-website-id) need_arg "$1" "${2:-}"; UMAMI_WEBSITE_ID="$2"; shift 2 ;;
        --proxy)        need_arg "$1" "${2:-}"; SSH_PROXY="$2"; shift 2 ;;
        -e|--env)       SHOW_ENV=true; shift ;;
        --build)        BUILD_ONLY=true; shift ;;
        -h|--help)      usage ;;
        *)              err "未知参数: $1"; usage ;;
    esac
done

SSH_COMMON_ARGS=(-o ConnectTimeout=30 -o ServerAliveInterval=30 -o ServerAliveCountMax=3)
if [ -n "$SSH_PROXY" ]; then
    if [[ ! "$SSH_PROXY" =~ ^[A-Za-z0-9._:-]+$ ]]; then
        err "SSH 代理地址只能包含字母、数字、点、下划线、冒号和短横线"
        exit 1
    fi
    SSH_COMMON_ARGS+=(-o "ProxyCommand=/usr/bin/nc -X 5 -x $SSH_PROXY %h %p")
    log "使用 SOCKS5 代理: $SSH_PROXY"
fi

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

# ---------- 查看服务器环境（-e） ----------
if $SHOW_ENV; then
    step "查看服务器 .env 配置（隐藏值）"
    ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "
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

# ---------- Step 0: 前置检查 ----------
step "环境检查"

if ! command -v ssh &>/dev/null; then
    err "未找到 ssh 命令"
    exit 1
fi
ok "本地基础命令正常"

# ---------- Step 1: 本地构建验证 ----------
step "Step 1: 准备 .env.production 并本地构建验证"

if [ ! -f "package.json" ]; then
    err "请在项目根目录执行此脚本"
    exit 1
fi

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

# ---------- Step 2: 远程环境检查 ----------
step "Step 2: 远程环境检查（142 服务器）"

if ! SSH_CHECK_OUTPUT=$(ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" 'docker compose version' 2>&1); then
    err "无法连接服务器或 Docker 未就绪"
    echo "$SSH_CHECK_OUTPUT" >&2
    exit 1
fi
ok "服务器连接正常"

# ---------- Step 3: 上传源码 ----------
step "Step 3: 上传源码至服务器"

log "打包源码..."
REMOTE_TMP="/tmp/gpt-image-deploy-$(date +%s).tar.gz"
tar czf "$REMOTE_TMP" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='generated-images' \
    --exclude='.env.local' \
    --exclude='.DS_Store' \
    --exclude='.vercel' \
    --exclude='coverage' \
    --exclude='build' \
    --exclude='out' \
    --exclude='src-tauri/target' \
    --exclude='src-tauri/gen' \
    --exclude='.playwright-cli' \
    --exclude='tmp-qa' \
    --exclude='test-results' \
    --exclude='*.tsbuildinfo' \
    --exclude='.env.production' \
    --exclude='scripts' \
    .

log "传输至服务器 ($SERVER_IP)..."
scp "${SSH_COMMON_ARGS[@]}" "$REMOTE_TMP" "$SERVER_USER@$SERVER_IP:/tmp/"

log "解压并清理..."
ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR && tar xzf /tmp/$(basename "$REMOTE_TMP") -C $REMOTE_DIR && rm /tmp/$(basename "$REMOTE_TMP") && find $REMOTE_DIR -name '._*' -delete"

rm -f "$REMOTE_TMP"

# 上传 .env
build_remote_env_file
scp "${SSH_COMMON_ARGS[@]}" "$DEPLOY_ENV_FILE" "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/.env"
ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "chmod 600 '$REMOTE_DIR/.env'"
rm -f "$DEPLOY_ENV_FILE"
ok "源码上传完成"

# ---------- Step 4: 构建并启动容器 ----------
step "Step 4: 构建并启动 Docker 容器"

ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "cd $REMOTE_DIR && docker compose down 2>/dev/null; docker compose up -d --build 2>&1"

sleep 3

if ! ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "docker ps --filter name=gpt-image --format '{{.Status}}' | grep -q Up"; then
    err "容器启动失败，请查看日志:"
    ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "docker logs gpt-image-playground --tail 20"
    exit 1
fi
ok "容器运行中"

# ---------- Step 5: 配置 Caddy ----------
step "Step 5: 配置 Caddy 反向代理"

ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "
    set -euo pipefail
    ensure_html_cache_headers() {
        if sudo awk '/^$DOMAIN \\{/{flag=1} flag && /header_down Cache-Control \"no-cache, no-store, must-revalidate\"/{found=1} flag && /^}/{flag=0} END{exit found ? 0 : 1}' $CADDY_FILE; then
            return 0
        fi

        sudo cp $CADDY_FILE $CADDY_FILE.bak.\$(date +%Y%m%d%H%M%S)
        sudo python3 - <<'PY'
from pathlib import Path

caddy_file = Path('$CADDY_FILE')
domain = '$DOMAIN'
insert = [
    '    @html path /',
    '    reverse_proxy @html 127.0.0.1:$CONTAINER_PORT {',
    '        header_down Cache-Control \"no-cache, no-store, must-revalidate\"',
    '        header_down Pragma \"no-cache\"',
    '        header_down Expires \"0\"',
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
    }

    if ! grep -q '$DOMAIN' $CADDY_FILE; then
        sudo cp $CADDY_FILE $CADDY_FILE.bak.\$(date +%Y%m%d%H%M%S)
        echo '' | sudo tee -a $CADDY_FILE
        echo '$DOMAIN {' | sudo tee -a $CADDY_FILE
        echo '    @html path /' | sudo tee -a $CADDY_FILE
        echo '    reverse_proxy @html 127.0.0.1:$CONTAINER_PORT {' | sudo tee -a $CADDY_FILE
        echo '        header_down Cache-Control \"no-cache, no-store, must-revalidate\"' | sudo tee -a $CADDY_FILE
        echo '        header_down Pragma \"no-cache\"' | sudo tee -a $CADDY_FILE
        echo '        header_down Expires \"0\"' | sudo tee -a $CADDY_FILE
        echo '    }' | sudo tee -a $CADDY_FILE
        echo '    reverse_proxy 127.0.0.1:$CONTAINER_PORT' | sudo tee -a $CADDY_FILE
        echo '}' | sudo tee -a $CADDY_FILE
        sudo caddy validate --config $CADDY_FILE
        sudo systemctl reload caddy
        echo 'CADDY_UPDATED'
    else
        ensure_html_cache_headers
        sudo caddy validate --config $CADDY_FILE
        sudo systemctl reload caddy
        echo 'CADDY_ALREADY_EXISTS_RELOADED'
    fi
"

sleep 2

log "检查 HTTPS 证书状态..."
HTTP_CODE=$(ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "curl -sI -o /dev/null -w '%{http_code}' https://$DOMAIN --max-time 10" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "301" ]] || [[ "$HTTP_CODE" == "302" ]]; then
    ok "HTTPS 访问正常 (HTTP $HTTP_CODE)"
elif [[ "$HTTP_CODE" == "000" ]]; then
    warn "HTTPS 暂未就绪，Caddy 正在自动签发 SSL 证书（通常需要 1-2 分钟），请稍后访问"
    log "手动检查：curl -sI https://$DOMAIN"
else
    ok "服务已响应 (HTTP $HTTP_CODE)"
fi

# ---------- Step 6: 完成 ----------
step "部署完成"

echo -e "  ${GREEN}域名:   ${NC}https://$DOMAIN"
echo -e "  ${GREEN}容器:   ${NC}gpt-image-playground (端口 $CONTAINER_PORT:$HOST_PORT)"
echo -e "  ${GREEN}源码:   ${NC}$REMOTE_DIR"

if [ -n "$OPENAI_KEY" ]; then
    echo -e "  ${YELLOW}API Key:  ${NC}已在 .env 中设置"
    warn "生产环境建议使用 .env.production 模板管理，不要将 Key 提交到版本控制"
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
echo "  查看日志:   ssh $SERVER_USER@$SERVER_IP \"docker logs -f gpt-image-playground\""
echo "  重启容器:   ssh $SERVER_USER@$SERVER_IP \"cd $REMOTE_DIR && docker compose restart\""
echo "  查看配置:   $0 -e"
echo "  停止服务:   ssh $SERVER_USER@$SERVER_IP \"cd $REMOTE_DIR && docker compose down\""
