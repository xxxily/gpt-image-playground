#!/usr/bin/env bash
set -euo pipefail

: "${NODE_RUNTIME_VERSION:?NODE_RUNTIME_VERSION is required}"
: "${NODE_DIST_BASE:?NODE_DIST_BASE is required}"
: "${APP_NAME:?APP_NAME is required}"
: "${LOCAL_VERSION:?LOCAL_VERSION is required}"
: "${ARTIFACT_NAME:?ARTIFACT_NAME is required}"
: "${DEPLOY_TIMESTAMP:?DEPLOY_TIMESTAMP is required}"

BUILD_BACKEND_LABEL="${BUILD_BACKEND_LABEL:-docker}"
NATIVE_MODE="linux-glibc228"

log() { printf '[RUNTIME-BUILD] %s\n' "$1"; }
warn() { printf '[RUNTIME-BUILD] WARN %s\n' "$1" >&2; }
die() {
    printf '[RUNTIME-BUILD] ERROR %s\n' "$1" >&2
    exit 1
}

install_container_tools() {
    export DEBIAN_FRONTEND=noninteractive

    cat > /etc/apt/sources.list <<'APT'
deb http://archive.debian.org/debian buster main
deb http://archive.debian.org/debian-security buster/updates main
APT
    printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99archive

    log "Installing container build tools"
    apt-get update
    apt-get install -y --no-install-recommends ca-certificates curl xz-utils python3 make g++ rsync file binutils
}

prepare_node_runtime() {
    local node_archive="node-v${NODE_RUNTIME_VERSION}-linux-x64.tar.xz"
    NODE_DIR="/cache/node-v${NODE_RUNTIME_VERSION}-linux-x64"

    if [ ! -x "$NODE_DIR/bin/node" ]; then
        log "Downloading Node.js runtime v${NODE_RUNTIME_VERSION}"
        curl -fL --retry 3 --retry-delay 2 "$NODE_DIST_BASE/v${NODE_RUNTIME_VERSION}/$node_archive" -o "/cache/$node_archive"
        rm -rf "$NODE_DIR"
        tar -xf "/cache/$node_archive" -C /cache
    fi

    export PATH="$NODE_DIR/bin:$PATH"
    node -v
    npm -v
}

patch_better_sqlite3_build_flag() {
    local binding_file="node_modules/better-sqlite3/binding.gyp"

    if [ -f "$binding_file" ] && grep -q -- "-std=c++20" "$binding_file"; then
        log "Patching better-sqlite3 C++ standard flag for Debian 10 toolchain"
        sed -i 's/-std=c++20/-std=c++2a/g' "$binding_file"
    fi
}

install_dependencies() {
    log "Installing project dependencies without lifecycle scripts"
    npm_config_platform=linux \
    npm_config_arch=x64 \
    npm_config_libc=glibc \
    npm_config_jobs=1 \
    npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false \
    npm_config_cache=/cache/npm \
    npm_config_ignore_scripts=true \
    npm ci --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc

    patch_better_sqlite3_build_flag

    log "Building better-sqlite3 from source against glibc 2.28"
    npm_config_jobs=1 npm rebuild better-sqlite3 --build-from-source --no-audit --no-fund

    for package_name in esbuild sharp unrs-resolver; do
        if [ -d "node_modules/$package_name" ]; then
            log "Rebuilding install artifacts for $package_name"
            npm rebuild "$package_name" --no-audit --no-fund
        fi
    done
}

build_next_app() {
    log "Building Next.js standalone server output"
    NEXT_STANDALONE_BUILD=1 npm run build

    if [ ! -f ".next/standalone/server.js" ]; then
        die ".next/standalone/server.js was not produced"
    fi
}

write_deployment_metadata() {
    local runtime_dir="$1"

    cat > "$runtime_dir/DEPLOYMENT.txt" <<EOF
app=${APP_NAME}
version=${LOCAL_VERSION}
node=${NODE_RUNTIME_VERSION}
target=linux-x64-glibc
native_mode=${NATIVE_MODE}
builder=${BUILD_BACKEND_LABEL}
built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

write_build_summary() {
    local runtime_dir="$1"
    local artifact_size="${2:-pending}"
    local summary_file="$runtime_dir/BUILD_SUMMARY.txt"
    local runtime_size

    runtime_size="$(du -sh "$runtime_dir" | awk '{print $1}')"

    {
        printf 'build_backend=%s\n' "$BUILD_BACKEND_LABEL"
        printf 'native_mode=%s\n' "$NATIVE_MODE"
        printf 'node_runtime_version=%s\n' "$NODE_RUNTIME_VERSION"
        printf 'runtime_size=%s\n' "$runtime_size"
        printf 'artifact=%s\n' "$ARTIFACT_NAME"
        printf 'artifact_size=%s\n' "$artifact_size"
        printf 'included_top_level=\n'
        find "$runtime_dir" -mindepth 1 -maxdepth 1 -exec basename {} \; | sort | sed 's/^/  - /'
        printf 'component_sizes=\n'
        for path in "$runtime_dir/bin" "$runtime_dir/.next" "$runtime_dir/node_modules" "$runtime_dir/public" "$runtime_dir/server.js"; do
            if [ -e "$path" ]; then
                du -sh "$path"
            fi
        done
    } > "$summary_file"
}

assemble_runtime_bundle() {
    local runtime_dir
    local native_module
    local max_glibc
    local artifact="/out/$ARTIFACT_NAME"
    local artifact_size

    runtime_dir="$(mktemp -d)"

    log "Assembling traced standalone runtime"
    rsync -a --delete .next/standalone/ "$runtime_dir/"
    mkdir -p "$runtime_dir/bin" "$runtime_dir/.next"
    rsync -a --delete .next/static/ "$runtime_dir/.next/static/"
    rsync -a --delete public/ "$runtime_dir/public/"
    cp "$NODE_DIR/bin/node" "$runtime_dir/bin/node"
    chmod 755 "$runtime_dir/bin/node"

    rm -rf \
        "$runtime_dir/.next/cache" \
        "$runtime_dir/.next/dev" \
        "$runtime_dir/node_modules/.cache" \
        "$runtime_dir/node_modules/@next/swc-linux-x64-musl" \
        "$runtime_dir/node_modules/@img/sharp-linuxmusl-x64" \
        "$runtime_dir/node_modules/@img/sharp-libvips-linuxmusl-x64"

    write_deployment_metadata "$runtime_dir"

    native_module="$runtime_dir/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
    if ! file "$native_module" | grep -Eq 'ELF 64-bit.*x86-64'; then
        die "better-sqlite3 is not a Linux x64 binary"
    fi

    max_glibc="$(strings "$native_module" | grep -o 'GLIBC_[0-9.]*' | sort -V | tail -1 || true)"
    log "better-sqlite3 max GLIBC symbol: ${max_glibc:-unknown}"

    (
        cd "$runtime_dir"
        ./bin/node <<'NODE'
const Database = require('better-sqlite3');
const db = new Database(':memory:');
const row = db.prepare('select 1 as ok').get();
db.close();
if (row.ok !== 1) throw new Error('better-sqlite3 runtime check failed');
require('next/package.json');
console.log('runtime dependency check ok');
NODE
    )

    write_build_summary "$runtime_dir" "pending"

    mkdir -p /out
    tar -czf "$artifact" -C "$runtime_dir" .
    artifact_size="$(du -sh "$artifact" | awk '{print $1}')"
    write_build_summary "$runtime_dir" "$artifact_size"
    tar -czf "$artifact" -C "$runtime_dir" .

    log "Runtime artifact ready: $artifact"
    du -sh "$artifact" "$runtime_dir" | sed 's/^/[RUNTIME-BUILD]   /'
    sed 's/^/[RUNTIME-BUILD]   /' "$runtime_dir/BUILD_SUMMARY.txt"
}

install_container_tools
prepare_node_runtime
install_dependencies
build_next_app
assemble_runtime_bundle
