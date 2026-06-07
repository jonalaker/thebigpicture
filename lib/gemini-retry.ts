// Retry helper for transient Gemini 429 (rate/quota) errors.
//
// Short per-minute spikes recover with a brief exponential backoff. Long
// (per-day) quota exhaustion is surfaced immediately — Google reports a large
// `retryDelay`, and there's no point blocking a request for minutes.

const MAX_DELAY_MS = 4000;

function isRateLimitError(msg: string): boolean {
    return /\b429\b|rate limit|quota|resource has been exhausted/i.test(msg);
}

// Google errors sometimes embed e.g. "retryDelay":"21s"
function extractRetryDelayMs(msg: string): number | null {
    const m = msg.match(/retryDelay"?\s*:?\s*"?(\d+)s/i);
    return m ? parseInt(m[1], 10) * 1000 : null;
}

export async function withGeminiRetry<T>(
    fn: () => Promise<T>,
    opts: { retries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
    const { retries = 3, baseDelayMs = 500, label = "gemini" } = opts;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);

            if (!isRateLimitError(msg) || attempt === retries) throw err;

            // If Google asks us to wait longer than our cap, it's a long/daily
            // quota — fail fast rather than hang the request.
            const suggested = extractRetryDelayMs(msg);
            if (suggested !== null && suggested > MAX_DELAY_MS) throw err;

            const delay = Math.min(
                suggested ?? baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250),
                MAX_DELAY_MS
            );
            console.warn(`⏳ ${label} rate-limited (attempt ${attempt + 1}/${retries}); retrying in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    throw lastErr;
}
