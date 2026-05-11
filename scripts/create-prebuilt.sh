#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

version="$(node -p "require('./package.json').version")"
sha="$(git rev-parse --short HEAD)"
name="9router-prebuilt-${version}-${sha}"
out_dir="dist/prebuilt"
archive="dist/${name}.tar.gz"
build_data_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$build_data_dir"
}
trap cleanup EXIT

rm -rf "$out_dir" "$archive"
mkdir -p "$out_dir" dist

npm install --no-audit --no-fund
DATA_DIR="$build_data_dir" npm run build

cp -a .next/standalone/. "$out_dir/"
mkdir -p "$out_dir/.next"
cp -a .next/static "$out_dir/.next/static"

if [ -d public ]; then
  cp -a public "$out_dir/public"
fi

cat > "$out_dir/BUILD_INFO" <<INFO
version=$version
sha=$sha
built_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INFO

tar -C "$out_dir" -czf "$archive" .
printf '%s\n' "$archive"
