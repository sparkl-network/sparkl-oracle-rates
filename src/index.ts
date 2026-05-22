import { RateSetterPusher } from "./chain/pusher.js";
import { loadConfig } from "./config.js";
import { recordError, recordFetch, recordPush, startHealthServer } from "./health.js";
import { createPricers } from "./pricer/index.js";
import { MedianAggregator } from "./pricer/median.js";

async function main() {
  const cfg = loadConfig();

  const sources = createPricers(cfg.PRICE_SOURCES, cfg.COINGECKO_API_KEY);
  const aggregator = new MedianAggregator(sources);
  const pusher = new RateSetterPusher(cfg);

  startHealthServer(cfg.HEALTH_PORT);

  const tick = async () => {
    try {
      const rate = await aggregator.fetch();
      recordFetch(rate.fetchedAt);
      const pushed = await pusher.push(rate);
      if (pushed) recordPush();
    } catch (err) {
      recordError(err);
      console.error("Oracle tick failed:", err);
    }
  };

  await tick();
  setInterval(tick, cfg.UPDATE_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
