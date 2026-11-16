#!/bin/bash
set -euo pipefail

printf 'Pega la contraseña NUEVA de PostgreSQL de Supabase (no se mostrará): '
trap 'stty echo 2>/dev/null || true' EXIT
IFS= read -r -s SUPABASE_DB_PASSWORD
stty echo
trap - EXIT
printf '\n'

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
  echo 'No se recibió una contraseña.' >&2
  exit 1
fi

export SUPABASE_DATABASE_URL="$(SUPABASE_DB_PASSWORD="$SUPABASE_DB_PASSWORD" node -e 'process.stdout.write(`postgresql://postgres.htnwdnzbnkojdmouudsz:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`)')"
unset SUPABASE_DB_PASSWORD
npm run migrate:supabase

printf '%s' "$SUPABASE_DATABASE_URL" | vercel env add DATABASE_URL production --sensitive --yes --force
unset SUPABASE_DATABASE_URL

vercel deploy --prod
