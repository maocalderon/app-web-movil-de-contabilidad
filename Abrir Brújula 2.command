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

npm run dev -- --host 0.0.0.0 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT INT TERM

echo "Iniciando Brújula..."
until curl -fsS http://localhost:5173/ >/dev/null 2>&1; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "No se pudo iniciar el servidor."
    read -r "?Presiona Enter para cerrar..."
    exit 1
  fi
  sleep 1
done

open http://localhost:5173
echo "Brújula está abierta. Deja esta ventana activa mientras la usas."
wait "$SERVER_PID"
