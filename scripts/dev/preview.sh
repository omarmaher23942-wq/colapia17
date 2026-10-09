#!/usr/bin/env bash
# preview.sh — معاينة المنصة ولوحة التاجر محلياً ببيانات حقيقية في Postgres محلي، في بيئة معزولة تماماً
# عن أي مفتاح حقيقي (env -i + قيم وهمية من local.env). مصمم لبيئة Linux (ومنها جلسات Claude السحابية).
#
#   bash scripts/dev/preview.sh setup     # Postgres محلي + migrations + بيانات تجريبية (متجر nova)
#   bash scripts/dev/preview.sh dev       # setup ثم خادم التطوير على http://localhost:3100
#   bash scripts/dev/preview.sh seed      # إعادة البيانات التجريبية من الصفر
#   bash scripts/dev/preview.sh run <cmd> # أي أمر داخل البيئة المعزولة نفسها
#   bash scripts/dev/preview.sh shot /dashboard/orders orders both dark --full   # لقطات (والخادم يعمل)
#
# الدخول للوحة: كوكي clp_m بالقيمة التي يطبعها seed (dev-merchant-session-token-...) على localhost.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV="$ROOT/scripts/dev"
CACHE="${DEVSTACK_HOME:-$HOME/.cache/colapia-dev}"
PGPORT="${DEVSTACK_PG_PORT:-5433}"
PGSOCK=/tmp
PG_MODULE="$CACHE/node/node_modules/pg"

pg_bin() {
  if command -v pg_config >/dev/null 2>&1 && [ -x "$(pg_config --bindir)/initdb" ]; then pg_config --bindir; return; fi
  ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1
}

# Postgres يرفض العمل كـ root؛ عندها يُشغَّل بمستخدم postgres في مجلد يملكه.
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
pg_data() { if [ "$(id -u)" = 0 ]; then echo /var/lib/postgresql/colapia-dev/data; else echo "$CACHE/pgdata"; fi; }

ensure_pg_module() {
  [ -d "$PG_MODULE" ] && return
  echo "• تثبيت pg في $CACHE/node (خارج المشروع)"
  npm install --prefix "$CACHE/node" pg@8 --no-audit --no-fund --silent
}

ensure_postgres() {
  local bin data
  bin="$(pg_bin)"
  [ -n "$bin" ] || { echo "✗ Postgres غير مثبت (initdb غير موجود)"; exit 1; }
  data="$(pg_data)"
  if [ ! -f "$data/PG_VERSION" ]; then
    echo "• إنشاء قاعدة محلية في $data"
    mkdir -p "$data"
    [ "$(id -u)" = 0 ] && chown -R postgres:postgres "$(dirname "$data")"
    as_pg "$bin/initdb -D '$data' -A trust -U postgres -E UTF8 >/dev/null"
  fi
  if ! "$bin/pg_isready" -h "$PGSOCK" -p "$PGPORT" >/dev/null 2>&1; then
    as_pg "$bin/pg_ctl -D '$data' -o '-p $PGPORT -k $PGSOCK' -l '$data/../pg.log' -w start >/dev/null"
  fi
  psql -h "$PGSOCK" -p "$PGPORT" -U postgres -tAc "select 1 from pg_database where datname='colapia'" | grep -q 1 \
    || psql -h "$PGSOCK" -p "$PGPORT" -U postgres -qc "create database colapia"
}

# البيئة المعزولة: لا يمر من بيئة الجلسة إلا PATH وHOME وإعدادات الشبكة (الوكيل وشهادته).
isolated() {
  local pass=()
  for v in NODE_EXTRA_CA_CERTS HTTPS_PROXY https_proxy HTTP_PROXY http_proxy NO_PROXY no_proxy; do
    [ -n "${!v:-}" ] && pass+=("$v=${!v}")
  done
  # fetch في Node لا يمر بالوكيل إلا بهذا (لجلب صور من روابط خارجية في المعاينة مثلاً).
  [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ] && pass+=("NODE_USE_ENV_PROXY=1")
  cd "$ROOT"
  env -i PATH="$PATH" HOME="$HOME" TERM="${TERM:-dumb}" NEXT_TELEMETRY_DISABLED=1 "${pass[@]}" \
    NODE_OPTIONS="--require $DEV/local-services.cjs" \
    DEVSTACK_PG_MODULE="$PG_MODULE" \
    DEVSTACK_PG_URL="postgresql://postgres@127.0.0.1:$PGPORT/colapia" \
    $(grep -v '^\s*#' "$DEV/local.env" | grep '=' | xargs) \
    "$@"
}

setup() {
  ensure_pg_module
  ensure_postgres
  isolated npx tsx scripts/db-migrate.ts
  isolated npx tsx scripts/dev/seed.ts
}

ensure_playwright() {
  [ -d "$CACHE/node/node_modules/playwright" ] && return
  echo "• تثبيت playwright في $CACHE/node (يستخدم Chromium المثبت مسبقاً إن وُجد)"
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "$CACHE/node" playwright@1.56.1 --no-audit --no-fund --silent
}

case "${1:-dev}" in
  setup) setup ;;
  seed) ensure_pg_module; ensure_postgres; isolated npx tsx scripts/dev/seed.ts ;;
  dev) setup; isolated npx next dev -p 3100 ;;
  run) shift; ensure_pg_module; ensure_postgres; isolated "$@" ;;
  shot) shift; ensure_playwright; DEVSTACK_HOME="$CACHE" node "$DEV/shot.mjs" "$@" ;;
  *) echo "الاستخدام: preview.sh [setup|seed|dev|run <cmd>|shot <path> ...]"; exit 1 ;;
esac
