#!/bin/bash
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Stopping Impact"
pkill -f "$APP_DIR/index.js" || true
pm2 delete all || true
echo "All stopped."
