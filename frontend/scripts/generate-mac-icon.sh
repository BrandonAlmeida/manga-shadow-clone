#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ICON="$ROOT_DIR/public/favicon.svg"
BUILD_DIR="$ROOT_DIR/build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"
BASE_PNG="$ICONSET_DIR/icon_1024x1024.png"
OUTPUT_ICON="$BUILD_DIR/icon.icns"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "Arquivo de icone nao encontrado: $SOURCE_ICON"
  exit 1
fi

mkdir -p "$BUILD_DIR"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sips -s format png "$SOURCE_ICON" --out "$BASE_PNG" >/dev/null

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$BASE_PNG" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
  retina_size=$((size * 2))
  sips -z "$retina_size" "$retina_size" "$BASE_PNG" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICON"
rm -rf "$ICONSET_DIR"

echo "Icone macOS gerado em: $OUTPUT_ICON"
