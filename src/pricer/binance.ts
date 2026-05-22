import type { IPricer } from "./index.js";

export class BinancePricer implements IPricer {
  async fetchDotUsd(): Promise<number> {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=DOTUSDT",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const data = (await res.json()) as { price: string };
    const price = parseFloat(data.price);
    if (!price || price <= 0) throw new Error("Binance returned invalid price");
    return price;
  }
}
