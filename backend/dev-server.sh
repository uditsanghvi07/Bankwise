#!/usr/bin/env bash
# Start uvicorn on the first free port in 9001, 9003, 9004 (default API 9001; skips 9002 so a
# local Next dev server can use the frontend port 9002 on the same machine).

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
for p in 9001 9003 9004; do
  if port_free "$p"; then
    PORT="$p"
    break
  fi
done

if [[ -z "$PORT" ]]; then
  echo "Ports 9001, 9003, and 9004 are all in use on 127.0.0.1." >&2
  echo "Free one with (requires sudo), e.g.:" >&2
  echo "  sudo fuser -k 9001/tcp" >&2
  echo "Or find the listener:  ss -tlnp | grep ':9001'" >&2
  exit 1
fi

if [[ "$PORT" != "9001" ]]; then
  echo "================================================================" >&2
  echo "  Port 9001 is busy — starting API on ${PORT}" >&2
  echo "  Before \"npm run dev\" in the frontend, run:" >&2
  echo "    export INTERNAL_API_URL=http://127.0.0.1:${PORT}" >&2
  echo "================================================================" >&2
fi

exec .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port "$PORT"
