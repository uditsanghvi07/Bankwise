import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function upstreamBase(): string {
  return (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
}

/**
 * FastAPI redirects POST `/api/chat` → `/api/chat/`. Node's fetch follows that with the POST body
 * and can throw "detached ArrayBuffer" (undici). Request the slash form directly so there is no
 * redirect hop.
 */
function normalizeUpstreamPathname(pathname: string): string {
  if (pathname === "/api/chat") return "/api/chat/";
  return pathname;
}

function filterRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === "host") return;
    out.set(key, value);
  });
  return out;
}

function filterResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  upstream.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.set(key, value);
  });
  return out;
}

async function proxy(req: NextRequest): Promise<NextResponse> {
  const base = upstreamBase();
  const pathname = normalizeUpstreamPathname(req.nextUrl.pathname);
  const search = req.nextUrl.search;
  const target = `${base}${pathname}${search}`;

  const headers = filterRequestHeaders(req.headers);
  const method = req.method;
  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(method)) {
    body = await req.arrayBuffer();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    console.error("[BankWise API proxy] failed:", target, e);
    return NextResponse.json(
      {
        detail:
          "The UI server could not reach the Python API. If you use Docker, keep INTERNAL_API_URL=http://backend:8000 for the frontend container. If you run `npm run dev`, start the API on port 8000 or set INTERNAL_API_URL to that server.",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const resHeaders = filterResponseHeaders(upstream.headers);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest) {
  return proxy(req);
}

export async function POST(req: NextRequest) {
  return proxy(req);
}

export async function PUT(req: NextRequest) {
  return proxy(req);
}

export async function PATCH(req: NextRequest) {
  return proxy(req);
}

export async function DELETE(req: NextRequest) {
  return proxy(req);
}

export async function OPTIONS(req: NextRequest) {
  return proxy(req);
}
