#!/usr/bin/env bash
# Publie une nouvelle version de maPoche (macOS arm64) sur le bucket Supabase `updates`.
#
# Usage : scripts/release.sh 1.8.0 "Notes de version" [--yes]
#   SUPABASE_SERVICE_ROLE_KEY : variable d'environnement, sinon lue dans .env.local ou .env (ignorés par git)
#   --yes : publie sans demander confirmation
#
# Étapes : vérifs → bump version → tests → build signé → latest.json → upload → commit + tag
set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"
ASSUME_YES="${3:-}"
SUPABASE_URL="https://cllhgyvomuvyidwwnlto.supabase.co"
BUCKET="updates"
KEY_FILE="$HOME/.tauri/mapoche.key"
KEY_PASSWORD_FILE="$HOME/.tauri/mapoche.key.password"
BUNDLE_DIR="src-tauri/target/release/bundle/macos"

die() { echo "✗ $*" >&2; exit 1; }
step() { echo; echo "▶ $*"; }

cd "$(dirname "$0")/.."

# Vite n'expose que les variables VITE_* : la clé de service ne finit jamais dans le bundle.
for f in .env.local .env; do
  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" && -f "$f" ]]; then
    SUPABASE_SERVICE_ROLE_KEY="$(sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' "$f" | tr -d '"' | head -1)"
  fi
done

# --- Vérifications ---------------------------------------------------------
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Version invalide. Usage : $0 1.8.0 \"Notes\""
[[ -n "$NOTES" ]] || die "Notes de version manquantes."
[[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || die "SUPABASE_SERVICE_ROLE_KEY non défini (variable d'environnement, .env.local ou .env)."
[[ -f "$KEY_FILE" ]] || die "Clé de signature introuvable : $KEY_FILE"
[[ -z "$(git status --porcelain)" ]] || die "Working tree non propre : commite ou stash d'abord."
git rev-parse "v$VERSION" >/dev/null 2>&1 && die "Le tag v$VERSION existe déjà."

CURRENT=$(node -p "require('./package.json').version")
[[ "$(printf '%s\n%s\n' "$CURRENT" "$VERSION" | sort -V | tail -1)" == "$VERSION" && "$CURRENT" != "$VERSION" ]] \
  || die "La version $VERSION doit être supérieure à $CURRENT."

# --- Bump de version (package.json, tauri.conf.json, Cargo.toml) -----------
step "Version $CURRENT → $VERSION"
npm version "$VERSION" --no-git-tag-version >/dev/null  # package.json + package-lock.json
node -e '
  const fs = require("fs");
  const f = "src-tauri/tauri.conf.json";
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  j.version = process.argv[1];
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
' "$VERSION"
sed -i '' "1,/^version = \".*\"/s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# --- Tests + build signé ---------------------------------------------------
step "Tests"
npm test

step "Build Tauri (le front est buildé via beforeBuildCommand)"
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"
[[ -f "$KEY_PASSWORD_FILE" ]] && export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat "$KEY_PASSWORD_FILE")"
npm run tauri:build

TARBALL="$BUNDLE_DIR/maPoche.app.tar.gz"
[[ -f "$TARBALL" && -f "$TARBALL.sig" ]] || die "Artefacts de mise à jour absents dans $BUNDLE_DIR"

# --- latest.json -----------------------------------------------------------
# Nom versionné : évite qu'un cache CDN serve un ancien .tar.gz avec la nouvelle signature.
REMOTE_TARBALL="maPoche_${VERSION}_aarch64.app.tar.gz"
step "Génération de latest.json"
node -e '
  const fs = require("fs");
  const [version, notes, sigFile, url, out] = process.argv.slice(1);
  const manifest = {
    version,
    notes,
    pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    platforms: {
      "darwin-aarch64": { signature: fs.readFileSync(sigFile, "utf8").trim(), url },
    },
  };
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
' "$VERSION" "$NOTES" "$TARBALL.sig" \
  "$SUPABASE_URL/storage/v1/object/public/$BUCKET/$REMOTE_TARBALL" "$BUNDLE_DIR/latest.json"
cat "$BUNDLE_DIR/latest.json"

# --- Upload ----------------------------------------------------------------
if [[ "$ASSUME_YES" != "--yes" ]]; then
  read -r -p $'\nPublier la version '"$VERSION"$' pour tous les utilisateurs ? [o/N] ' answer
  [[ "$answer" =~ ^[oOyY]$ ]] || die "Publication annulée (les fichiers de version restent modifiés localement)."
fi

upload() { # upload <fichier local> <nom distant> <content-type> <cache-control>
  curl --fail-with-body -sS -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$2" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: $3" -H "Cache-Control: $4" -H "x-upsert: true" \
    --data-binary "@$1" >/dev/null
  echo "  ✓ $2"
}

step "Upload vers Supabase Storage ($BUCKET)"
# L'archive d'abord : latest.json ne doit jamais pointer vers un fichier absent.
upload "$TARBALL" "$REMOTE_TARBALL" "application/gzip" "max-age=31536000"
upload "$BUNDLE_DIR/latest.json" "latest.json" "application/json" "max-age=60"

curl -fsS "$SUPABASE_URL/storage/v1/object/public/$BUCKET/latest.json" | grep -q "\"$VERSION\"" \
  || echo "⚠ latest.json public ne renvoie pas encore $VERSION (cache ?) — revérifie dans une minute."

# --- Commit + tag ----------------------------------------------------------
step "Commit et tag"
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "release: v$VERSION"
git tag "v$VERSION"

echo
echo "✓ maPoche $VERSION publiée. Pense à : git push && git push --tags"
echo "  Test : lance une install $CURRENT → la bannière $VERSION doit apparaître."
