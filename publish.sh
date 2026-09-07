#!/usr/bin/env bash
# Commit everything and push it live.
#   ./publish.sh                 -> commits as "Update site"
#   ./publish.sh "Add 2027 paper"
set -euo pipefail
cd "$(dirname "$0")"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No 'origin' remote yet. Create the GitHub repository first, then run:"
  echo "  git remote add origin https://github.com/<owner>/<repo>.git"
  exit 1
fi

if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo "Nothing changed."
  exit 0
fi

git add -A
git commit -m "${1:-Update site}"
git push origin main
echo
echo "Pushed. GitHub Pages usually redeploys within a minute or two."
