#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/install-prebuilt.sh <tarball-path-or-url>" >&2
  exit 2
fi

source_arg="$1"
tmp_dir="$(mktemp -d)"
archive="$tmp_dir/9router-prebuilt.tar.gz"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

if [[ "$source_arg" =~ ^https?:// ]]; then
  curl -fL "$source_arg" -o "$archive"
else
  cp "$source_arg" "$archive"
fi

rm -rf .next/standalone .next/static
mkdir -p .next/standalone
tar -xzf "$archive" -C .next/standalone

pm2 delete 9router || true
pm2 start ecosystem.config.cjs
pm2 save
