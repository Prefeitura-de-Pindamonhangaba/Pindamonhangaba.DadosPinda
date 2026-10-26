#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d -t pinda-deploy-tests.XXXXXXXX)"
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/workspace"
cp "$root/compose.yml" "$root/compose.release.yml" "$fixture/workspace/"
cat > "$fixture/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$MOCK_COMMANDS"
if [[ "$*" == *'config --format json'* ]]; then
  cat "$MOCK_CONFIG"
elif [[ "$*" == *'run --rm --no-deps init'* && "$MOCK_CASE" == init_failure ]]; then
  echo 'Migrações pendentes.' >&2
  exit 1
elif [[ "$*" == *'up --detach --no-build --wait'* && "$MOCK_CASE" == health_failure ]]; then
  exit 1
fi
MOCK
chmod +x "$fixture/bin/docker"
export PATH="$fixture/bin:$PATH"
export RELEASE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export RELEASE_ID="$RELEASE_SHA-123-1"
export DEPLOY_PLATFORM=linux/amd64
if [[ "$(uname -m)" == aarch64 || "$(uname -m)" == arm64 ]]; then export DEPLOY_PLATFORM=linux/arm64; fi
export DEPLOY_PROJECT=pinda-test
printf -v digest '%064d' 0
export APP_IMAGE="ghcr.io/example/pinda@sha256:$digest"
export TOOLS_IMAGE="$APP_IMAGE"

for scenario in success dev_mode init_failure health_failure mutable_tag; do
  export MOCK_CASE="$scenario"
  export DEPLOY_DIR="$fixture/$scenario"
  export MOCK_CONFIG="$fixture/$scenario.json"
  export MOCK_COMMANDS="$fixture/$scenario.commands"
  mkdir "$DEPLOY_DIR"
  printf 'DATABASE_URL=DO_NOT_LOG_TEST_SECRET\n' > "$DEPLOY_DIR/.env"
  printf 'previous-approved-release\n' > "$DEPLOY_DIR/current-release"
  mode=production
  [[ "$scenario" != dev_mode ]] || mode=development
  printf '{"services":{"app":{"environment":{"COMPOSE_PROFILES":"%s"}},"init":{"environment":{"COMPOSE_PROFILES":"%s"}}}}\n' "$mode" "$mode" > "$MOCK_CONFIG"
  : > "$MOCK_COMMANDS"
  candidate="$APP_IMAGE"
  [[ "$scenario" != mutable_tag ]] || candidate=ghcr.io/example/pinda:latest
  status=0
  (cd "$fixture/workspace"; APP_IMAGE="$candidate" bash "$root/scripts/deploy-production.sh") > "$fixture/$scenario.log" 2>&1 || status=$?
  if grep -q DO_NOT_LOG_TEST_SECRET "$fixture/$scenario.log"; then echo 'Segredo exposto.' >&2; exit 1; fi
  if [[ "$scenario" == success ]]; then
    [[ "$status" == 0 && "$(cat "$DEPLOY_DIR/current-release")" == "$RELEASE_ID" ]]
    [[ -f "$DEPLOY_DIR/releases/$RELEASE_ID/images.env" ]]
  else
    [[ "$status" != 0 && "$(cat "$DEPLOY_DIR/current-release")" == previous-approved-release ]]
  fi
  if [[ "$scenario" == init_failure || "$scenario" == dev_mode || "$scenario" == mutable_tag ]]; then
    if grep -q 'up --detach' "$MOCK_COMMANDS"; then echo 'Aplicação substituída antes de aprovar o pré-deploy.' >&2; exit 1; fi
  fi
  printf 'OK: %s\n' "$scenario"
done
