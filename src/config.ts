import { z } from "zod";

const schema = z.object({
  // Chain
  EVM_RPC_URL: z.string().url(),
  RATE_SETTER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  ORACLE_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),

  // Timing
  UPDATE_INTERVAL_MS: z.coerce.number().default(300_000), // 5 min default
  DEVIATION_THRESHOLD: z.coerce.number().default(0.005), // 0.5% — skip push if rate unchanged
  MAX_STALENESS_MS: z.coerce.number().default(3_600_000), // 1h — should match RateSetter.maxStaleness

  // Price sources (comma-separated priority order)
  PRICE_SOURCES: z.string().default("coingecko,binance"),

  // Health server
  HEALTH_PORT: z.coerce.number().default(8090),

  // Optional CoinGecko API key (free tier works without it)
  COINGECKO_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
  return schema.parse(process.env);
}
