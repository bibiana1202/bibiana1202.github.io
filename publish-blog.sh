#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  if [ -x /opt/homebrew/opt/node@22/bin/node ]; then
    export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
  else
    echo 'Node.js 22 이상이 필요합니다. nvm use 22 후 다시 실행해 주세요.' >&2
    exit 1
  fi
fi
if [ "${1:-}" = "--dry-run" ]; then
  node scripts/sync-content.mjs --dry-run
  exit
fi
if [ "$#" -gt 0 ] && [ "$1" != "--push" ]; then
  echo 'Usage: ./publish-blog.sh [--dry-run|--push]' >&2
  exit 1
fi
node scripts/sync-content.mjs
node scripts/validate-content.mjs
npx quartz build
if [ "${1:-}" != "--push" ]; then
  echo '로컬 빌드 완료. GitHub push는 수행하지 않았습니다.'
  exit
fi
node scripts/push-approved.mjs
