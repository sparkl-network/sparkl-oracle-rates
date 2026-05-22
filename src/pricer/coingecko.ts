import type { IPricer } from "./index.js";

export class CoinGeckoPricer implements IPricer {
  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async fetchDotUsd(): Promise<number> {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=polkadot&vs_currencies=usd";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) headers["x-cg-demo-api-key"] = this.apiKey;

    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

    const data = (await res.json()) as { polkadot: { usd: number } };
    const price = data?.polkadot?.usd;
    if (!price || price <= 0) throw new Error("CoinGecko returned invalid price");
    return price;
  }
}
