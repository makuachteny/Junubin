/**
 * Lightweight Sentry shim for Edge Functions.
 *
 * Sentry's Deno SDK ships as `https://deno.land/x/sentry@.../index.mjs`
 * but we don't want every function to take a hard dependency on the
 * network during cold start. Instead we use the Sentry "envelope HTTP"
 * endpoint directly — a single POST that captures one event.
 *
 * Gated on SENTRY_DSN: when the env var is unset the helpers are
 * no-ops so functions deployed without Sentry configured still run.
 *
 * Usage:
 *   import { captureException, withSentry } from "../_shared/sentry.ts";
 *
 *   // Option A: wrap the whole handler
 *   Deno.serve(withSentry("stripe-webhook", async (req) => { ... }));
 *
 *   // Option B: capture inline
 *   try { ... } catch (err) { await captureException(err, { fn: "stripe-webhook" }); throw err; }
 */

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") || "";
// Accept NODE_ENV or ENVIRONMENT — the operator runbook sets ENVIRONMENT
// while older code read only NODE_ENV, which mislabelled every prod
// error as "development" on the Sentry dashboard. Read both.
const ENVIRONMENT = Deno.env.get("NODE_ENV") || Deno.env.get("ENVIRONMENT") || "development";
const RELEASE = Deno.env.get("SENTRY_RELEASE") || "";

// Parse the DSN once at module load. Shape: https://<key>@<host>/<projectId>
let parsed: { host: string; key: string; projectId: string } | null = null;
if (SENTRY_DSN) {
  try {
    const u = new URL(SENTRY_DSN);
    parsed = {
      host: u.host,
      key: u.username,
      projectId: u.pathname.replace(/^\//, ""),
    };
  } catch {
    console.warn("[sentry] Invalid SENTRY_DSN — disabling capture");
  }
}

export function isSentryEnabled(): boolean {
  return parsed !== null;
}

/**
 * POST a single exception event to Sentry. Best-effort — failures
 * inside the capture path are swallowed so they never mask the
 * underlying error.
 */
export async function captureException(
  err: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  if (!parsed) return;

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  const stack = err instanceof Error && err.stack ? err.stack : undefined;

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: ENVIRONMENT,
    release: RELEASE || undefined,
    exception: {
      values: [
        {
          type: err instanceof Error ? err.name : "Error",
          value: message,
          stacktrace: stack ? { frames: parseStack(stack) } : undefined,
        },
      ],
    },
    tags: { runtime: "deno" },
    extra: context,
  };

  try {
    await fetch(
      `https://${parsed.host}/api/${parsed.projectId}/store/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth":
            `Sentry sentry_version=7,sentry_client=junubin-edge/0.1,sentry_key=${parsed.key}`,
        },
        body: JSON.stringify(event),
      },
    );
  } catch (e) {
    // Capture failed — log locally so Supabase function logs still
    // show that something went wrong, but don't throw.
    console.error("[sentry] capture failed:", (e as Error).message);
  }
}

/**
 * Wrap a handler so any uncaught throw is reported before being
 * rethrown. Use this instead of remembering to catch + capture in
 * every function.
 */
export function withSentry<T>(
  fnName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      await captureException(err, { function: fnName, url: req.url });
      throw err;
    }
  };
}

/**
 * Minimal stack parser — extracts file/line/col from V8 / Deno stack
 * frames. Sentry will accept "raw" too, but parsed frames render
 * better in the dashboard.
 */
function parseStack(stack: string): Array<{ filename?: string; lineno?: number; colno?: number; function?: string }> {
  return stack
    .split("\n")
    .slice(1) // first line is the message
    .map((line) => {
      const m = line.trim().match(/^at\s+(?:([^\s]+)\s+\()?(.+?):(\d+):(\d+)\)?$/);
      if (!m) return null;
      return {
        function: m[1] || undefined,
        filename: m[2],
        lineno: Number(m[3]),
        colno: Number(m[4]),
      };
    })
    .filter(Boolean) as Array<{ filename?: string; lineno?: number; colno?: number; function?: string }>;
}
