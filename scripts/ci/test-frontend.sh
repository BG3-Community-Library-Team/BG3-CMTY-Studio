#!/usr/bin/env bash
set -euo pipefail

npm ci
npx paraglide-js compile --project ./project.inlang --outdir ./src/paraglide
npm run test:coverage
