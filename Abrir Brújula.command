#!/bin/zsh

cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "No encuentro npm. Instala Node.js para ejecutar Brújula."
  read -r "?Presiona Enter para cerrar..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Preparando Brújula por primera vez..."
  npm install || exit 1
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "Iniciando PostgreSQL..."
  brew services start postgresql@16 || exit 1
  until pg_isready -h localhost -p 5432 >/dev/null 2>&1; do sleep 1; done
fi

if ! psql -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = 'brujula_finanzas'" | grep -q 1; then
  createdb brujula_finanzas || exit 1
fi

node server/index.js &
API_PID=$!
WEB_PID=""
cleanup() {
  kill "$API_PID" 2>/dev/null
  if [[ -n "$WEB_PID" ]]; then kill "$WEB_PID" 2>/dev/null; fi
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Conectando con PostgreSQL..."
until curl -fsS http://localhost:3001/api/health >/dev/null 2>&1; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "No se pudo iniciar la API o conectar PostgreSQL."
    read -r "?Presiona Enter para cerrar..."
    exit 1
  fi
  sleep 1
done

./node_modules/.bin/vite --host 0.0.0.0 --strictPort &
WEB_PID=$!
until curl -fsS http://localhost:5173/ >/dev/null 2>&1; do
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "No se pudo iniciar la web. Cierra otros servidores que ocupen el puerto 5173."
    read -r "?Presiona Enter para cerrar..."
    exit 1
  fi
  sleep 1
done

open http://localhost:5173
echo "Brújula conectada a PostgreSQL. Deja esta ventana activa mientras la usas."
wait "$WEB_PID"
