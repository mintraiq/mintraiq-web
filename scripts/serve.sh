#!/usr/bin/env bash
# Serve static site locally (required for Logto redirect URIs — file:// will not work).
# Usage: ./scripts/serve.sh 8080
PORT="${1:-8080}"
cd "$(dirname "$0")/.." && python3 -m http.server "$PORT"
