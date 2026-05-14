#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GPT Image Playground - 129 production deployment script
#
# Target: 129 production server
# Domain: img-playground.anzz.site
# Strategy:
#   1. Build the Next.js output locally.
#   2. Build a Linux x64 runtime bundle locally, including:
#      - production node_modules for linux/x64/glibc
#      - a pinned Linux x64 Node.js binary
#      - .next and public assets
#   3. Upload the bundle to 129.
#   4. Let 129 only unpack, switch the current symlink, and restart systemd.
# ============================================================

SERVER_IP="159.75.70.129"
SERVER_USER="root"
SERVER_PORT="22"
REMOTE_DIR="/root/work/gpt-image-playground"
RELEASES_DIR="$REMOTE_DIR/releases"
SHARED_DIR="$REMOTE_DIR/shared"
CURRENT_LINK="$REMOTE_DIR/current"
DOMAIN="img-playground.anzz.site"
NODE_PORT="3000"
CADDY_FILE="/etc/caddy/Caddyfile"
APP_NAME="gpt-image-playground"
SERVICE_NAME="gpt-image-playground"
LOG_DIR="/var/log/gpt-image-playground"
SSH_PROXY="${SSH_PROXY:-}"
NODE_RUNTIME_VERSION="${DEPLOY_NODE_VERSION:-20.20.2}"
NODE_DIST_BASE="${NODE_DIST_BASE:-https://nodejs.org/dist}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}  OK  $1${NC}"; }
warn() { echo -e "${YELLOW}  WARN  $1${NC}"; }
err()  { echo -e "${RED}  ERROR  $1${NC}" >&2; }
step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

SHOW_ENV=false
BUILD_ONLY=false
OPENAI_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
APP_PASSWORD=""
UMAMI_SCRIPT_URL="${UMAMI_SCRIPT_URL:-}"
UMAMI_WEBSITE_ID="${UMAMI_WEBSITE_ID:-}"
LOCAL_ENV_FILE=".env.production"
USING_LOCAL_ENV_FILE=false
DEPLOY_ENV_FILE=""

DEPLOY_ROOT=".deploy/129"
CACHE_DIR="$DEPLOY_ROOT/cache"
LINUX_DEPS_DIR="$DEPLOY_ROOT/linux-x64-prod"
RUNTIME_DIR="$DEPLOY_ROOT/runtime"
ARTIFACT_DIR="$DEPLOY_ROOT/artifacts"

usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  -k, --key KEY          Set OPENAI_API_KEY when .env.production does not exist
  -b, --base-url URL     Set OPENAI_API_BASE_URL when .env.production does not exist
  -p, --password PWD     Set APP_PASSWORD when .env.production does not exist
  --umami-script-url URL Set UMAMI_SCRIPT_URL when .env.production does not exist
  --umami-website-id ID  Set UMAMI_WEBSITE_ID when .env.production does not exist
  --proxy HOST:PORT      Use a SOCKS5 proxy for SSH, for example 127.0.0.1:7890
  -e, --env              Print remote environment keys with values hidden
  --build                Build the local Linux x64 runtime bundle only
  -h, --help             Show help

Compatibility:
  --install-pm2 and --pm2-startup are accepted but ignored. The 129 service is
  now managed by systemd and a bundled Node.js runtime, not PM2/nvm.
EOF
    exit 0
}

need_arg() {
    local opt="$1"
    local value="${2:-}"
    if [ -z "$value" ] || [[ "$value" == -* ]]; then
        err "$opt requires a value"
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
        --install-pm2|--pm2-startup)
            warn "$1 is no longer needed; 129 now uses systemd with a bundled Node.js runtime"
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
            err "Unknown option: $1"
            usage
            ;;
    esac
done

SSH_COMMON_ARGS=(-p "$SERVER_PORT" -o ConnectTimeout=30 -o ServerAliveInterval=30 -o ServerAliveCountMax=3)
if [ -n "$SSH_PROXY" ]; then
    if [[ ! "$SSH_PROXY" =~ ^[A-Za-z0-9._:-]+$ ]]; then
        err "SSH proxy must only contain letters, numbers, dot, underscore, colon, and dash"
        exit 1
    fi
    SSH_COMMON_ARGS+=(-o "ProxyCommand=/usr/bin/nc -X 5 -x $SSH_PROXY %h %p")
    log "Using SOCKS5 proxy: $SSH_PROXY"
fi

remote_ssh() {
    ssh "${SSH_COMMON_ARGS[@]}" "$SERVER_USER@$SERVER_IP" "$@"
}

remote_bash() {
    remote_ssh "bash -seuo pipefail"
}

upload_file() {
    local local_path="$1"
    local remote_path="$2"
    local remote_parent="${remote_path%/*}"

    remote_ssh "umask 077 && mkdir -p '$remote_parent' && cat > '$remote_path'" < "$local_path"
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
        err "Environment values cannot contain newlines"
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
    fail(lineNumber, 'export KEY=value syntax is not supported; use KEY=value');
    return;
  }

  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) {
    fail(lineNumber, 'unsupported dotenv line; only KEY=value is supported');
    return;
  }

  const value = match[2].trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && !value.endsWith(quote)) {
    fail(lineNumber, 'multiline or unclosed quoted dotenv values are not supported');
  }

  if (/(^|[^\\])\$\{?[A-Za-z_][A-Za-z0-9_]*(?:[}:][^}]*)?\}?/.test(value)) {
    fail(lineNumber, 'variable expansion is not supported; write the final value');
  }
});
NODE
    then
        err "$file uses unsupported dotenv syntax"
        exit 1
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
        err "UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID must be set together, or both left empty"
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
            err "Local $LOCAL_ENV_FILE is not readable"
            exit 1
        fi

        validate_supported_dotenv_syntax "$LOCAL_ENV_FILE"
        load_status_from_env_file "$LOCAL_ENV_FILE"
        validate_umami_config
        log "Using existing $LOCAL_ENV_FILE as the only production environment source:"
        redact_env_content < "$LOCAL_ENV_FILE"
        ok "$LOCAL_ENV_FILE will be copied to the remote shared .env without regeneration"
        return 0
    fi

    USING_LOCAL_ENV_FILE=false
    validate_umami_config
    generate_env
    log "$LOCAL_ENV_FILE not found; generating a minimal fallback configuration:"
    printf '%s' "$ENV_CONTENT" | redact_env_content
    printf '%s' "$ENV_CONTENT" > "$LOCAL_ENV_FILE"
    chmod 600 "$LOCAL_ENV_FILE"
    ok "$LOCAL_ENV_FILE generated"
}

tar_supports() {
    tar --help 2>&1 | grep -q -- "$1"
}

create_tar() {
    local source_dir="$1"
    local artifact="$2"
    local args=(czf "$artifact")

    if tar_supports '--no-xattrs'; then
        args+=(--no-xattrs)
    fi
    if tar_supports '--disable-copyfile'; then
        args+=(--disable-copyfile)
    fi

    COPYFILE_DISABLE=1 tar "${args[@]}" -C "$source_dir" .
}

ensure_local_tools() {
    local required_cmd
    for required_cmd in ssh tar npm node curl rsync file; do
        if ! command -v "$required_cmd" >/dev/null 2>&1; then
            err "Local command not found: $required_cmd"
            exit 1
        fi
    done
}

ensure_local_node_modules() {
    if [ -f "node_modules/next/dist/bin/next" ]; then
        return 0
    fi

    warn "Local node_modules is missing; installing local build dependencies"
    npm ci --no-audit --no-fund
}

download_node_runtime() {
    local node_archive="node-v$NODE_RUNTIME_VERSION-linux-x64.tar.xz"
    local node_url="$NODE_DIST_BASE/v$NODE_RUNTIME_VERSION/$node_archive"
    local node_archive_path="$CACHE_DIR/$node_archive"
    NODE_RUNTIME_DIR="$CACHE_DIR/node-v$NODE_RUNTIME_VERSION-linux-x64"

    if [ -x "$NODE_RUNTIME_DIR/bin/node" ]; then
        ok "Linux x64 Node.js runtime already cached: v$NODE_RUNTIME_VERSION"
        return 0
    fi

    mkdir -p "$CACHE_DIR"
    log "Downloading Linux x64 Node.js runtime: $node_url"
    curl -fL --retry 3 --retry-delay 2 "$node_url" -o "$node_archive_path"

    rm -rf "$NODE_RUNTIME_DIR"
    tar -xf "$node_archive_path" -C "$CACHE_DIR"

    if ! file "$NODE_RUNTIME_DIR/bin/node" | grep -Eq 'ELF 64-bit.*x86-64'; then
        err "Downloaded Node.js runtime is not Linux x64"
        exit 1
    fi

    ok "Linux x64 Node.js runtime prepared: v$NODE_RUNTIME_VERSION"
}

install_linux_prod_deps() {
    step "Step 2: build Linux x64 production dependencies locally"

    rm -rf "$LINUX_DEPS_DIR"
    mkdir -p "$LINUX_DEPS_DIR"
    cp package.json package-lock.json "$LINUX_DEPS_DIR/"

    (
        cd "$LINUX_DEPS_DIR"
        npm_config_platform=linux \
        npm_config_arch=x64 \
        npm_config_libc=glibc \
        npm_config_jobs=1 \
        npm_config_audit=false \
        npm_config_fund=false \
        npm_config_update_notifier=false \
        npm_config_cache="$PWD/../npm-cache-linux-x64" \
        npm ci --omit=dev --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc
    )

    if ! file "$LINUX_DEPS_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node" | grep -Eq 'ELF 64-bit.*x86-64'; then
        err "better-sqlite3 is not a Linux x64 binary"
        exit 1
    fi
    if [ ! -f "$LINUX_DEPS_DIR/node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node" ]; then
        err "Next.js Linux x64 SWC package is missing"
        exit 1
    fi
    if [ ! -d "$LINUX_DEPS_DIR/node_modules/@img/sharp-linux-x64" ]; then
        err "sharp Linux x64 package is missing"
        exit 1
    fi

    ok "Linux x64 production dependencies are ready"
}

assemble_runtime_bundle() {
    step "Step 3: assemble local runtime bundle"

    download_node_runtime

    rm -rf "$RUNTIME_DIR"
    mkdir -p "$RUNTIME_DIR/bin"

    rsync -a --delete "$LINUX_DEPS_DIR/node_modules/" "$RUNTIME_DIR/node_modules/"
    rsync -a --delete ".next/" "$RUNTIME_DIR/.next/"
    rsync -a --delete "public/" "$RUNTIME_DIR/public/"

    cp package.json package-lock.json next.config.ts "$RUNTIME_DIR/"
    cp "$NODE_RUNTIME_DIR/bin/node" "$RUNTIME_DIR/bin/node"
    chmod 755 "$RUNTIME_DIR/bin/node"

    rm -rf \
        "$RUNTIME_DIR/.next/cache" \
        "$RUNTIME_DIR/.next/dev" \
        "$RUNTIME_DIR/node_modules/.cache" \
        "$RUNTIME_DIR/node_modules/@next/swc-linux-x64-musl" \
        "$RUNTIME_DIR/node_modules/@img/sharp-linuxmusl-x64" \
        "$RUNTIME_DIR/node_modules/@img/sharp-libvips-linuxmusl-x64"

    {
        printf 'app=%s\n' "$APP_NAME"
        printf 'version=%s\n' "$LOCAL_VERSION"
        printf 'node=%s\n' "$NODE_RUNTIME_VERSION"
        printf 'target=linux-x64-glibc\n'
        printf 'built_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    } > "$RUNTIME_DIR/DEPLOYMENT.txt"

    mkdir -p "$ARTIFACT_DIR"
    DEPLOY_TIMESTAMP="$(date +%Y%m%d%H%M%S)"
    ARTIFACT="$ARTIFACT_DIR/$APP_NAME-v$LOCAL_VERSION-$DEPLOY_TIMESTAMP-linux-x64.tar.gz"
    create_tar "$RUNTIME_DIR" "$ARTIFACT"

    ok "Runtime artifact created: $ARTIFACT"
    du -sh "$ARTIFACT" "$RUNTIME_DIR" | sed 's/^/  /'
}

ensure_caddy() {
    step "Step 6: verify Caddy reverse proxy"

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
    caddy validate --config '$CADDY_FILE'
    systemctl reload caddy
else
    caddy validate --config '$CADDY_FILE'
    if systemctl is-active caddy >/dev/null 2>&1; then
        systemctl reload caddy
    else
        systemctl start caddy
    fi
fi
EOF

    ok "Caddy is configured"
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
            ok "$label is ready (HTTP $code)"
            return 0
        fi
        sleep "$delay"
    done

    err "$label is not ready (last HTTP $code)"
    return 1
}

deploy_remote_release() {
    step "Step 5: unpack and activate on 129"

    local remote_artifact="$REMOTE_DIR/incoming/$(basename "$ARTIFACT")"
    local remote_env="$REMOTE_DIR/incoming/.env.$DEPLOY_TIMESTAMP"
    local release_dir="$RELEASES_DIR/$DEPLOY_TIMESTAMP-v$LOCAL_VERSION"

    log "Uploading runtime artifact"
    upload_file "$ARTIFACT" "$remote_artifact"

    log "Uploading production environment file"
    build_remote_env_file
    upload_file "$DEPLOY_ENV_FILE" "$remote_env"
    rm -f "$DEPLOY_ENV_FILE"

    remote_bash <<EOF
set -euo pipefail

APP_NAME='$APP_NAME'
SERVICE_NAME='$SERVICE_NAME'
REMOTE_DIR='$REMOTE_DIR'
RELEASES_DIR='$RELEASES_DIR'
SHARED_DIR='$SHARED_DIR'
CURRENT_LINK='$CURRENT_LINK'
LOG_DIR='$LOG_DIR'
NODE_PORT='$NODE_PORT'
REMOTE_ARTIFACT='$remote_artifact'
REMOTE_ENV='$remote_env'
RELEASE_DIR='$release_dir'

source_nvm_for_legacy_pm2() {
    export NVM_DIR="\$HOME/.nvm"
    if [ -s "\$NVM_DIR/nvm.sh" ]; then
        # shellcheck disable=SC1090
        . "\$NVM_DIR/nvm.sh"
    fi
}

restore_legacy_pm2() {
    source_nvm_for_legacy_pm2
    if command -v pm2 >/dev/null 2>&1 && [ -f "\$REMOTE_DIR/ecosystem.config.cjs" ]; then
        cd "\$REMOTE_DIR"
        pm2 startOrReload ecosystem.config.cjs --only "\$APP_NAME" --update-env || true
        pm2 save || true
    fi
}

rollback() {
    local previous="\${1:-}"
    echo "Rolling back service activation" >&2
    if [ -n "\$previous" ] && [ -d "\$previous" ]; then
        ln -sfn "\$previous" "\$CURRENT_LINK"
        systemctl restart "\$SERVICE_NAME" || true
    else
        systemctl stop "\$SERVICE_NAME" || true
        restore_legacy_pm2
    fi
}

previous_release=""
if [ -L "\$CURRENT_LINK" ]; then
    previous_release="\$(readlink -f "\$CURRENT_LINK" || true)"
fi

mkdir -p "\$RELEASES_DIR" "\$SHARED_DIR" "\$LOG_DIR" "\$REMOTE_DIR/backup/env"
chmod 755 "\$LOG_DIR"

if [ -f "\$SHARED_DIR/.env" ]; then
    cp "\$SHARED_DIR/.env" "\$REMOTE_DIR/backup/env/.env.\$(date +%Y%m%d%H%M%S)"
elif [ -f "\$REMOTE_DIR/.env" ]; then
    cp "\$REMOTE_DIR/.env" "\$REMOTE_DIR/backup/env/.env.\$(date +%Y%m%d%H%M%S)"
fi

install -m 600 "\$REMOTE_ENV" "\$SHARED_DIR/.env"
cp "\$SHARED_DIR/.env" "\$REMOTE_DIR/.env"
chmod 600 "\$REMOTE_DIR/.env"

rm -rf "\$RELEASE_DIR"
mkdir -p "\$RELEASE_DIR"
tar --warning=no-unknown-keyword -xzf "\$REMOTE_ARTIFACT" -C "\$RELEASE_DIR"
chmod 755 "\$RELEASE_DIR/bin/node"
ln -sfn "\$SHARED_DIR/.env" "\$RELEASE_DIR/.env"

"\$RELEASE_DIR/bin/node" -v
cd "\$RELEASE_DIR"
better_sqlite3_version=\$("\$RELEASE_DIR/bin/node" -p "require('./node_modules/better-sqlite3/package.json').version")
node_abi=\$("\$RELEASE_DIR/bin/node" -p "process.versions.modules")
native_module="\$RELEASE_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
native_cache="\$SHARED_DIR/native/better-sqlite3-\$better_sqlite3_version-node-v\$node_abi-linux-x64-glibc228.node"
legacy_native="\$REMOTE_DIR/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
mkdir -p "\$SHARED_DIR/native"

if [ -f "\$native_cache" ]; then
    cp "\$native_cache" "\$native_module"
elif [ -f "\$legacy_native" ]; then
    legacy_version=\$("\$RELEASE_DIR/bin/node" -p "require('\$REMOTE_DIR/node_modules/better-sqlite3/package.json').version" 2>/dev/null || true)
    if [ "\$legacy_version" = "\$better_sqlite3_version" ]; then
        cp "\$legacy_native" "\$native_cache"
        cp "\$native_cache" "\$native_module"
    fi
fi

"\$RELEASE_DIR/bin/node" <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(':memory:');
const row = db.prepare('select 1 as ok').get();
db.close();
if (row.ok !== 1) throw new Error('better-sqlite3 runtime check failed');
require('next/package.json');
console.log('runtime dependency check ok');
NODE

cat > "/etc/systemd/system/\$SERVICE_NAME.service" <<UNIT
[Unit]
Description=GPT Image Playground
After=network.target

[Service]
Type=simple
WorkingDirectory=\$CURRENT_LINK
Environment=NODE_ENV=production
Environment=PORT=\$NODE_PORT
Environment=HOSTNAME=127.0.0.1
EnvironmentFile=\$SHARED_DIR/.env
ExecStart=\$CURRENT_LINK/bin/node \$CURRENT_LINK/node_modules/next/dist/bin/next start -H 127.0.0.1 -p \$NODE_PORT
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "\$SERVICE_NAME" >/dev/null

source_nvm_for_legacy_pm2
if command -v pm2 >/dev/null 2>&1 && pm2 describe "\$APP_NAME" >/dev/null 2>&1; then
    pm2 stop "\$APP_NAME" || true
    pm2 delete "\$APP_NAME" || true
    pm2 save || true
fi

ln -sfn "\$RELEASE_DIR" "\$CURRENT_LINK"

if ! systemctl restart "\$SERVICE_NAME"; then
    rollback "\$previous_release"
    journalctl -u "\$SERVICE_NAME" -n 80 --no-pager || true
    exit 1
fi

sleep 4
if ! systemctl is-active --quiet "\$SERVICE_NAME"; then
    rollback "\$previous_release"
    journalctl -u "\$SERVICE_NAME" -n 100 --no-pager || true
    exit 1
fi

systemctl --no-pager --full status "\$SERVICE_NAME" | sed -n '1,40p'

find "\$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn \
    | awk 'NR>5 {print substr(\$0, index(\$0,\$2))}' \
    | xargs -r rm -rf

rm -f "\$REMOTE_ARTIFACT" "\$REMOTE_ENV"
EOF

    ok "129 systemd service is active"
}

if $SHOW_ENV; then
    step "Remote environment keys"
    remote_ssh "
    env_file=''
    if [ -f '$SHARED_DIR/.env' ]; then
        env_file='$SHARED_DIR/.env'
    elif [ -f '$REMOTE_DIR/.env' ]; then
        env_file='$REMOTE_DIR/.env'
    fi

    if [ -n \"\$env_file\" ]; then
        while IFS='=' read -r key _; do
            case \"\$key\" in
                ''|'#'*) continue ;;
                *) printf '%s=<redacted>\\n' \"\$key\" ;;
            esac
        done < \"\$env_file\"
    else
        echo 'No remote .env file found'
    fi
    "
    exit 0
fi

step "Step 0: local checks"

if [ ! -f "package.json" ]; then
    err "Run this script from the project root"
    exit 1
fi

ensure_local_tools
ok "Local required commands are available"

LOCAL_NODE_MAJOR=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$LOCAL_NODE_MAJOR" -lt 20 ]; then
    err "Local Node.js must be >= 20 for Next.js build"
    exit 1
fi

LOCAL_VERSION=$(node -p "require('./package.json').version")
log "Local version: v$LOCAL_VERSION"
log "Bundled Linux Node.js: v$NODE_RUNTIME_VERSION"

step "Step 1: prepare environment and build locally"

prepare_env_file
export_env_file_for_build
export_secret_env_values
ensure_local_node_modules

log "Running npm run build"
npm run build
ok "Local Next.js build passed"

if [ ! -d ".next" ]; then
    err ".next does not exist after build"
    exit 1
fi

install_linux_prod_deps
assemble_runtime_bundle

if $BUILD_ONLY; then
    step "Build-only complete"
    echo "Artifact: $ARTIFACT"
    exit 0
fi

step "Step 4: remote checks"

if ! remote_ssh 'uname -n' >/dev/null 2>&1; then
    err "Cannot connect to server ($SERVER_IP)"
    exit 1
fi
ok "Server connection is available"

remote_bash <<'EOF'
set -euo pipefail
command -v systemctl >/dev/null
command -v tar >/dev/null
command -v curl >/dev/null
echo "systemd: $(systemctl --version | head -1)"
echo "glibc: $(ldd --version | head -1)"
df -h / | tail -1
free -h | grep -E '^(Mem|Swap)'
EOF

deploy_remote_release
ensure_caddy

step "Step 7: verify service"

if ! wait_for_http "http://127.0.0.1:$NODE_PORT/" "Local service" 30 2; then
    remote_ssh "journalctl -u '$SERVICE_NAME' -n 120 --no-pager || true"
    exit 1
fi

if ! wait_for_http "https://$DOMAIN/" "HTTPS service" 30 2; then
    warn "HTTPS verification failed; inspect Caddy logs with journalctl -u caddy -n 80 --no-pager"
    exit 1
fi

step "Step 8: resource snapshot"

remote_bash <<EOF
set -euo pipefail
echo '=== systemd ==='
systemctl --no-pager --full status '$SERVICE_NAME' | sed -n '1,35p'
echo ''
echo '=== process ==='
ps -o pid,ppid,%mem,%cpu,rss,cmd -C node | sed -n '1,8p' || true
echo ''
echo '=== memory ==='
free -h | grep -E '^(Mem|Swap)'
echo ''
echo '=== disk ==='
df -h / | tail -1
echo ''
echo '=== project size ==='
du -sh '$REMOTE_DIR' '$RELEASES_DIR' '$CURRENT_LINK' 2>/dev/null || true
echo ''
echo '=== active runtime ==='
readlink -f '$CURRENT_LINK'
'$CURRENT_LINK/bin/node' -v
EOF

step "Deployment complete"

echo -e "  ${GREEN}Domain:${NC}  https://$DOMAIN"
echo -e "  ${GREEN}Version:${NC} v$LOCAL_VERSION"
echo -e "  ${GREEN}Runtime:${NC} bundled Node.js v$NODE_RUNTIME_VERSION"
echo -e "  ${GREEN}Service:${NC} systemd '$SERVICE_NAME'"
echo -e "  ${GREEN}Current:${NC} $CURRENT_LINK"
echo -e "  ${GREEN}Port:${NC}    127.0.0.1:$NODE_PORT"

echo ""
log "Useful commands:"
echo "  Status:  ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"systemctl status $SERVICE_NAME --no-pager\""
echo "  Logs:    ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"journalctl -u $SERVICE_NAME -n 100 --no-pager\""
echo "  Restart: ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP \"systemctl restart $SERVICE_NAME\""
echo "  Env:     $0 -e"
