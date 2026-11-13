// The fetch the Neon driver uses for every query, with retries for network
// failures that happen before a request ever leaves the machine: a failed
// DNS lookup or a refused/timed-out connection. Those are safe to retry - the
// database never saw the query - and they are exactly what a flaky home
// router causes ("fetch failed" on login). Anything after the request was
// sent (a reset mid-response, an HTTP error, a SQL error) is not retried, so
// a write can never run twice.

// Error codes undici/Node report when the connection was never established.
const NOT_SENT = new Set([
  "ENOTFOUND", // DNS: name not found (or the resolver refused the query)
  "EAI_AGAIN", // DNS: temporary failure
  "ECONNREFUSED",
  "UND_ERR_CONNECT_TIMEOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

const DELAYS_MS = [150, 500];

// "fetch failed" hides the real reason a few causes deep.
export function networkErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function createResilientFetch(
  fetchImpl: typeof fetch,
  options: { delaysMs?: number[]; log?: (message: string) => void } = {}
): typeof fetch {
  const delays = options.delaysMs ?? DELAYS_MS;
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fetchImpl(input, init);
      } catch (error) {
        const code = networkErrorCode(error);
        const retry = code !== null && NOT_SENT.has(code) && attempt < delays.length;
        options.log?.(
          `database request failed (${code ?? (error instanceof Error ? error.message : "unknown")})` +
            (retry ? `, retrying (${attempt + 1}/${delays.length})` : "")
        );
        if (!retry) throw error;
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
    }
  };
}
