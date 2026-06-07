/**
 * Minimal HTTP fetch helper with timeout, UA, and typed error handling.
 * Uses the built-in `fetch` (Node 18+ / 20+).
 */

const UA = "info-radar/0.1 (https://github.com/info-radar)";

export interface FetchJsonOptions {
  /** Request timeout in milliseconds (default 10_000) */
  timeoutMs?: number;
  /** Custom headers merged on top of defaults */
  headers?: Record<string, string>;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/**
 * Fetch a URL and parse the response as JSON.
 *
 * Throws `FetchError` on timeout, non-2xx, or JSON parse failure.
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = 10_000, headers = {} } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new FetchError(`Request timed out after ${timeoutMs}ms`);
    }
    throw new FetchError(
      `Network error fetching ${url}: ${String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "(unable to read body)");
    throw new FetchError(
      `HTTP ${resp.status} from ${url}`,
      resp.status,
      body.slice(0, 500),
    );
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (err: unknown) {
    throw new FetchError(
      `Failed to parse JSON from ${url}: ${String(err)}`,
    );
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Plain text / HTML fetch
// ---------------------------------------------------------------------------

export interface FetchTextOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/**
 * Fetch a URL and return the response body as a string.
 *
 * Throws `FetchError` on timeout, non-2xx, or body read failure.
 */
export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<string> {
  const { timeoutMs = 10_000, headers = {} } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        ...headers,
      },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new FetchError(`Request timed out after ${timeoutMs}ms`);
    }
    throw new FetchError(
      `Network error fetching ${url}: ${String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "(unable to read body)");
    throw new FetchError(
      `HTTP ${resp.status} from ${url}`,
      resp.status,
      body.slice(0, 500),
    );
  }

  try {
    return await resp.text();
  } catch (err: unknown) {
    throw new FetchError(
      `Failed to read response body from ${url}: ${String(err)}`,
    );
  }
}
