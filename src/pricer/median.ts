import type { IPricer, PriceResult, PricerEntry } from "./index.js";
import { toOnChainRate } from "./index.js";

export class MedianAggregator {
  constructor(private readonly pricers: PricerEntry[]) {}

  async fetch(): Promise<PriceResult> {
    const results = await Promise.allSettled(
      this.pricers.map(({ name, pricer }) =>
        pricer.fetchDotUsd().then((price) => ({ name, price })),
      ),
    );

    const prices = results
      .filter(
        (r): r is PromiseFulfilledResult<{ name: string; price: number }> =>
          r.status === "fulfilled",
      )
      .map((r) => r.value);

    if (prices.length === 0) throw new Error("All price sources failed");

    const sorted = [...prices].sort((a, b) => a.price - b.price);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0
        ? (sorted[mid - 1].price + sorted[mid].price) / 2
        : sorted[mid].price;

    const sources = prices.map((p) => p.name).join(",");
    console.log(`Fetched DOT/USD: $${median.toFixed(4)} (sources: ${sources})`);

    return {
      ...toOnChainRate(median),
      source: sources,
      fetchedAt: Date.now(),
    };
  }
}
