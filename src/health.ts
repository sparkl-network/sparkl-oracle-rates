import { createServer } from "node:http";

export type HealthState = {
  lastFetchAt?: number;
  lastPushAt?: number;
  lastError?: string;
};

const state: HealthState = {};

export function recordFetch(at = Date.now()): void {
  state.lastFetchAt = at;
  state.lastError = undefined;
}

export function recordPush(at = Date.now()): void {
  state.lastPushAt = at;
}

export function recordError(err: unknown): void {
  state.lastError = err instanceof Error ? err.message : String(err);
}

export function startHealthServer(port: number): void {
  const server = createServer((req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...state }));
  });

  server.listen(port, () => {
    console.log(`Health server listening on :${port}/health`);
  });
}
