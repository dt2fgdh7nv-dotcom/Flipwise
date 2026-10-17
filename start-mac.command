#!/bin/bash
# FlipWise — start on macOS (double-click, or run: bash start-mac.command)
cd "$(dirname "$0")" || exit 1
PNPM="npx --yes pnpm@10.28.0"

pause() { echo; read -r -p "Press Enter to close this window." _; }

echo "=== FlipWise ==="
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Download the LTS version from https://nodejs.org, install it, then run this again."
  open "https://nodejs.org" 2>/dev/null
  pause; exit 1
fi
if ! node -e "process.exit(+process.versions.node.split('.')[0] < 20 ? 1 : 0)"; then
  echo "Your Node.js is too old ($(node -v)). Install the LTS version from https://nodejs.org and run this again."
  pause; exit 1
fi

echo "1/4 Installing components (first time takes a few minutes)..."
$PNPM install --frozen-lockfile || { echo "Install failed."; pause; exit 1; }
echo "2/4 Preparing the database and demo data..."
$PNPM run bootstrap || { echo "Setup failed."; pause; exit 1; }
echo "3/4 Building the app (about a minute)..."
$PNPM run build || { echo "Build failed."; pause; exit 1; }
echo "4/4 Starting FlipWise at http://localhost:3000"
echo "     Sign in: demo@flipwise.fi  /  flipwise-demo-2026"
echo "     Keep this window open while you use the app. Close it to stop FlipWise."
( until curl -s -o /dev/null http://localhost:3000; do sleep 1; done; open "http://localhost:3000" ) &
$PNPM run start
pause
