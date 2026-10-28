#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'Deploy interrompido: %s\n' "$1" >&2; exit 1; }
for executable in docker python3 flock realpath; do
  command -v "$executable" >/dev/null || fail "instale $executable no runner de produção."
done
[[ "${DEPLOY_DIR:-}" = /* && -d "$DEPLOY_DIR" ]] || fail "DEPLOY_DIR deve apontar para uma pasta absoluta já provisionada no servidor."
deploy_dir="$(realpath "$DEPLOY_DIR")"
[[ "$deploy_dir" != / ]] || fail "DEPLOY_DIR não pode ser a raiz do servidor."
[[ -f "$deploy_dir/.env" && -r "$deploy_dir/.env" ]] || fail "crie o .env privado de produção em DEPLOY_DIR, legível pelo runner."
[[ "${RELEASE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || fail "RELEASE_SHA inválido."
for reference in "${APP_IMAGE:-}" "${TOOLS_IMAGE:-}"; do
  [[ "$reference" =~ ^ghcr\.io/[a-z0-9][a-z0-9/._-]*@sha256:[a-f0-9]{64}$ ]] || fail "use imagens GHCR identificadas por digest SHA-256."
done
project="${DEPLOY_PROJECT:-pinda-dados}"
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail "DEPLOY_PROJECT inválido."
case "${DEPLOY_PLATFORM:-}" in
  linux/amd64) [[ "$(uname -m)" = x86_64 ]] || fail "imagem amd64 incompatível com o runner." ;;
  linux/arm64) [[ "$(uname -m)" = aarch64 || "$(uname -m)" = arm64 ]] || fail "imagem arm64 incompatível com o runner." ;;
  *) fail "configure DEPLOY_PLATFORM como linux/amd64 ou linux/arm64." ;;
esac
docker info >/dev/null 2>&1 || fail "o runner não consegue acessar o Docker."
docker compose version >/dev/null 2>&1 || fail "instale Docker Compose v2 com suporte a !reset e --wait (mínimo 2.24.4)."

# A trava cobre também execuções manuais fora do GitHub Actions.
exec 9>"$deploy_dir/.deploy.lock"
flock -n 9 || fail "há outro deploy em andamento nesta instalação."
release_id="${RELEASE_ID:-${RELEASE_SHA}-$(date +%s)-1}"
[[ "$release_id" =~ ^${RELEASE_SHA}-[0-9]+-[0-9]+$ ]] || fail "RELEASE_ID inválido."
release_dir="$deploy_dir/releases/$release_id"
[[ ! -e "$release_dir" ]] || fail "essa execução já possui uma release; use uma nova tentativa do workflow."
mkdir -p "$release_dir"
cp compose.yml compose.release.yml "$release_dir/"
printf 'APP_IMAGE=%s\nTOOLS_IMAGE=%s\n' "$APP_IMAGE" "$TOOLS_IMAGE" > "$release_dir/images.env"
compose=(docker compose --project-directory "$deploy_dir" --env-file "$deploy_dir/.env" --env-file "$release_dir/images.env" --project-name "$project" -f "$release_dir/compose.yml" -f "$release_dir/compose.release.yml")

# Nunca imprimir config: o JSON interpolado contém as credenciais do servidor.
if ! "${compose[@]}" config --format json 2>/dev/null | python3 -c '
import json, sys
try:
    config = json.load(sys.stdin)
    services = config["services"]
    if "db" in services or any(services[name]["environment"].get("COMPOSE_PROFILES") != "production" for name in ("app", "init")):
        sys.exit(1)
except (ValueError, KeyError, TypeError):
    sys.exit(1)
'; then
  fail "confira o .env: COMPOSE_PROFILES=production, configurações válidas e nenhum banco local ativo."
fi

"${compose[@]}" pull app init tools
# Falhas neste ponto preservam a aplicação que já está em execução.
"${compose[@]}" run --rm --no-deps init
if ! "${compose[@]}" up --detach --no-build --wait --wait-timeout 180 app; then
  fail "a nova aplicação não ficou saudável. A release anterior permanece registrada em current-release; consulte docs/github-actions.md para recuperação."
fi
printf '%s\n' "$release_id" > "$deploy_dir/current-release.tmp"
mv "$deploy_dir/current-release.tmp" "$deploy_dir/current-release"
printf 'Release %s publicada; health check do container aprovado.\n' "$RELEASE_SHA"
