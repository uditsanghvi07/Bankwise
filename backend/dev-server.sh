#!/usr/bin/env bash
# Start uvicorn on the first free port in 8000–8002 (avoids "address already in use" when 8000
# is held by another user/root process). If not 8000, prints the INTERNAL_API_URL for Next.js.

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -x .venv/bin/python ]]; then
  echo "Missing .venv — run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

port_free() {
  local p="$1"
  .venv/bin/python -c "
import socket, sys
p = int(sys.argv[1])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(0.25)
try:
    r = s.connect_ex(('127.0.0.1', p))
    sys.exit(0 if r != 0 else 1)
finally:
    s.close()
" "$p"
}

PORT=""
for p in 8000 8001 8002; do
  if port_free "$p"; then
    PORT="$p"
    break
  fi
done

if [[ -z "$PORT" ]]; then
  echo "Ports 8000–8002 are all in use on 127.0.0.1." >&2
  echo "Free one with (requires sudo):" >&2
  echo "  sudo fuser -k 8000/tcp" >&2
  echo "Or find the listener:  ss -tlnp | grep ':8000'" >&2
  exit 1
fi

if [[ "$PORT" != "8000" ]]; then
  echo "================================================================" >&2
  echo "  Port 8000 is busy — starting API on ${PORT}" >&2
  echo "  Before \"npm run dev\" in the frontend, run:" >&2
  echo "    export INTERNAL_API_URL=http://127.0.0.1:${PORT}" >&2
  echo "================================================================" >&2
fi

exec .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port "$PORT"
