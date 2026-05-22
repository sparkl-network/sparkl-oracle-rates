import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "../config.js";
import type { PriceResult } from "../pricer/index.js";
import { rateSetterAbi } from "./rateSetterAbi.js";

export class RateSetterPusher {
  private lastPushedUsdcPerDot: bigint = 0n;
  private chainId: number | undefined;

  constructor(private readonly cfg: Config) {}

  async push(rate: PriceResult): Promise<boolean> {
    const { publicClient, walletClient } = await this.clients();
    const stale = await this.isStale(publicClient);
    const deviates = this.deviates(rate.usdcPerDot);

    if (!deviates && !stale) {
      console.log("Rate within deviation threshold — skipping push");
      return false;
    }

    if (stale && !deviates) {
      console.log("On-chain rate stale — forcing push");
    }

    const hash = await walletClient.writeContract({
      address: this.cfg.RATE_SETTER_ADDRESS as `0x${string}`,
      abi: rateSetterAbi,
      functionName: "setRate",
      args: [rate.usdcPerDot, rate.dotPerUsdc],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`setRate tx confirmed: ${hash} (block ${receipt.blockNumber})`);

    this.lastPushedUsdcPerDot = rate.usdcPerDot;
    return true;
  }

  private async clients() {
    const account = privateKeyToAccount(this.cfg.ORACLE_PRIVATE_KEY as `0x${string}`);
    const transport = http(this.cfg.EVM_RPC_URL);
    const publicClient = createPublicClient({ transport });

    if (this.chainId === undefined) {
      this.chainId = await publicClient.getChainId();
    }

    const chain = defineChain({
      id: this.chainId,
      name: "hub-evm",
      nativeCurrency: { decimals: 18, name: "DOT", symbol: "DOT" },
      rpcUrls: { default: { http: [this.cfg.EVM_RPC_URL] } },
    });

    const walletClient = createWalletClient({
      account,
      chain,
      transport,
    });

    return { publicClient, walletClient };
  }

  private async isStale(publicClient: PublicClient): Promise<boolean> {
    const updatedAt = await publicClient.readContract({
      address: this.cfg.RATE_SETTER_ADDRESS as `0x${string}`,
      abi: rateSetterAbi,
      functionName: "priceUpdatedAt",
    });

    if (updatedAt === 0n) return true;

    const ageMs = Date.now() - Number(updatedAt) * 1000;
    return ageMs >= this.cfg.MAX_STALENESS_MS;
  }

  private deviates(newRate: bigint): boolean {
    if (this.lastPushedUsdcPerDot === 0n) return true;
    const threshold = BigInt(Math.round(this.cfg.DEVIATION_THRESHOLD * 10_000));
    const diff =
      newRate > this.lastPushedUsdcPerDot
        ? newRate - this.lastPushedUsdcPerDot
        : this.lastPushedUsdcPerDot - newRate;
    return diff * 10_000n > this.lastPushedUsdcPerDot * threshold;
  }
}
