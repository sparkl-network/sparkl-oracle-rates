import { BinancePricer } from "./binance.js";
import { CoinGeckoPricer } from "./coingecko.js";

export interface PriceResult {
  usdcPerDot: bigint; // USDC 6-dec units per 1 whole DOT
  dotPerUsdc: bigint; // 1e18 DOT units per 1 USDC smallest unit
  source: string;
  fetchedAt: number; // unix ms
}

export interface IPricer {
  fetchDotUsd(): Promise<number>; // raw USD price of 1 DOT
}

/** Convert a raw USD float to the two on-chain values */
export function toOnChainRate(dotUsd: number): { usdcPerDot: bigint; dotPerUsdc: bigint } {
  if (dotUsd <= 0) throw new Error("Invalid dotUsd price");
  const usdcPerDot = BigInt(Math.round(dotUsd * 1_000_000));
  const dotPerUsdc = 10n ** 24n / usdcPerDot;
  return { usdcPerDot, dotPerUsdc };
}

export type PricerEntry = { name: string; pricer: IPricer };

/** Build pricers from comma-separated source names (e.g. `coingecko,binance`). */
export function createPricers(
  sourcesCsv: string,
  coingeckoApiKey?: string,
): PricerEntry[] {
  return sourcesCsv.split(",").map((raw) => {
    const name = raw.trim();
    switch (name) {
      case "coingecko":
        return { name, pricer: new CoinGeckoPricer(coingeckoApiKey) };
      case "binance":
        return { name, pricer: new BinancePricer() };
      default:
        throw new Error(`Unknown price source: ${name}`);
    }
  });
}
