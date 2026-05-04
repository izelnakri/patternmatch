#!/usr/bin/env bash
# Pack the current build into a tarball, install it into a throwaway consumer
# directory alongside qunitx, and run the existing test suite against the
# installed package on every supported runtime. Intentionally different from
# `make test`: here `@izelnakri/patternmatch` resolves to the packed dist output, catching
# build / packaging regressions that source tests cannot see — wrong exports
# map, missing files, broken Deno conditional, etc.
#
# Usage: bash scripts/test-release.sh
#   (run from the repo root; npm pack triggers `prepare` which runs the build)
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CONSUMER=$(mktemp -d)
trap 'rm -rf "$CONSUMER"' EXIT

QUNITX_VERSION=$(node -p "require('$ROOT/package.json').devDependencies.qunitx")

# ── Pack ────────────────────────────────────────────────────────────────────
cd "$ROOT"
npm pack --pack-destination "$CONSUMER" --quiet 2>/dev/null
TARBALL=$(ls "$CONSUMER"/*.tgz | head -1)

# ── Install into a clean consumer directory ─────────────────────────────────
# qunitx is the test runner the existing suite uses; install it alongside the
# packed tarball so `import { module, test } from 'qunitx'` resolves.
cd "$CONSUMER"
printf '{"type":"module"}' > package.json
npm install --no-save --quiet "$TARBALL" "qunitx@$QUNITX_VERSION"
cp -r "$ROOT/test" .

# ── Node ────────────────────────────────────────────────────────────────────
echo "test-release: node"
node --test test/match-test.ts

# ── Deno ────────────────────────────────────────────────────────────────────
# Deno 2 auto-enables node_modules resolution from package.json deps, so
# `from '@izelnakri/patternmatch'` resolves through the package.json exports
# default condition inside the installed node_modules/@izelnakri/patternmatch/.
echo "test-release: deno"
deno test --allow-read test/match-test.ts

echo
echo "test-release: ok"
