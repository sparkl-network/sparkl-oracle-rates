# sparkl-oracle-rates — agent guide

**Repository:** [github.com/sparkl-network/sparkl-oracle-rates](https://github.com/sparkl-network/sparkl-oracle-rates)

TypeScript service that fetches DOT/USD from public APIs (CoinGecko, Binance), aggregates a **median**, and pushes rates to on-chain **`RateSetter.setRate`** on a timer. It is **not** the mock oracle used in local `DeployLocal` (that is `MockOracle` in Foundry); this service targets a deployed **`RateSetter`** (Paseo/production or local deploy when `RateSetter` is in `local.json`).

## Ecosystem position

| Repo | Relationship |
|------|----------------|
| **sparkl-solo** | Defines `contracts/src/RateSetter.sol` and deploys it (`DeployLocal.s.sol`, `DeployPaseo.s.sol`) with `updater` = oracle wallet |
| **sparkl-portal** | Does not run the oracle; escrow USDC↔DOT conversion on-chain consumes rates from `RateSetter` |
| **Workspace** | [../AGENTS.md](../AGENTS.md) |

```text
CoinGecko / Binance → sparkl-oracle-rates → RateSetter.setRate → SettlementEscrow (via oracle interface)
```

## Prerequisites

- **Node.js 20+**, **Yarn**
- **Foundry** (`cast`) recommended for wallet creation and on-chain checks
- Deployed **`RateSetter`** on the same `EVM_RPC_URL` you configure
- Oracle EOA funded with **native gas token** (DOT on Hub EVM; Anvil accounts are pre-funded when using launcher defaults)

## Quick start

```bash
yarn install
cp .env.example .env
# Set EVM_RPC_URL, RATE_SETTER_ADDRESS, ORACLE_PRIVATE_KEY (see README)
yarn build
yarn start
```

Dev without build step: `yarn dev`

Health: `GET http://localhost:8090/health` (port `HEALTH_PORT`, default `8090`)

## Run with sparkl-solo local stack

1. From **`sparkl-solo`**, run:

   ```bash
   ./scripts/launch-local.sh --skip-node   # or full stack; read printed env block
   ```

2. Copy the printed block into **`.env`** (`EVM_RPC_URL`, `RATE_SETTER_ADDRESS`, `ORACLE_PRIVATE_KEY`, etc.). Launcher uses Anvil account #1 as default oracle key; **`ORACLE_PRIVATE_KEY` must match `RateSetter.updater`**.

3. Verify:

   ```bash
   cast call "$RATE_SETTER_ADDRESS" "updater()(address)" --rpc-url "$EVM_RPC_URL"
   cast wallet address --private-key "$ORACLE_PRIVATE_KEY"
   ```

4. `yarn start` — watch logs for `setRate tx confirmed`.

Full wallet checklist: **[README.md](./README.md)** § Oracle wallet.

## Paseo / testnet

1. Deploy from **`sparkl-solo/contracts`** with `ORACLE_UPDATER_ADDRESS` set to your oracle wallet ([DeployPaseo.s.sol](https://github.com/sparkl-network/sparkl-solo/blob/main/contracts/script/DeployPaseo.s.sol)).
2. Fund oracle address with native DOT for gas.
3. Set `.env` from `contracts/deployments/paseo.json` → `rateSetter` (or field name in JSON).
4. Align `MAX_STALENESS_MS` with `RateSetter.maxStaleness` at deploy (seconds on-chain = ms env / 1000).

## Configuration

| Variable | Role |
|----------|------|
| `EVM_RPC_URL` | Hub EVM JSON-RPC |
| `RATE_SETTER_ADDRESS` | Deployed `RateSetter` |
| `ORACLE_PRIVATE_KEY` | Must equal `RateSetter.updater` |
| `UPDATE_INTERVAL_MS` | Poll interval (default 5 min) |
| `DEVIATION_THRESHOLD` | Min price move to push (default 0.5%) |
| `MAX_STALENESS_MS` | Force push if chain rate is stale |
| `PRICE_SOURCES` | `coingecko`, `binance` |
| `HEALTH_PORT` | HTTP health server |

See `.env.example` and README configuration table.

## Tests

This repo has **no automated unit/integration test suite** yet. Agent verification checklist:

```bash
yarn build                    # TypeScript compile
yarn start                    # run against configured chain
curl -s localhost:8090/health # JSON: lastPushAt, sources, etc.
```

Optional: Docker `docker build -t sparkl-oracle-rates .` && `docker run --env-file .env ...`

When adding tests, prefer **vitest** or **node:test** with mocked fetch + mocked viem client; do not hit live APIs in CI without fixtures.

## Contributing

1. Fork / branch on `sparkl-network/sparkl-oracle-rates`.
2. Keep secrets out of git (`.env` is gitignored).
3. PR should include: `yarn build` success, manual health/push evidence on Anvil or testnet, and README updates for new env vars.
4. Contract ABI changes belong in **sparkl-solo** first; this service embeds/minimal ABI in `src/chain/rateSetterAbi.ts` — update if `RateSetter` interface changes.

**Never commit:** `ORACLE_PRIVATE_KEY`, `.env`, or funded wallet mnemonics.

## Security

- Dedicated **hot wallet** for `updater` only.
- Rotate via on-chain `setUpdater(newAddress)` then update `.env`.
- Monitor wallet balance; pushes are paid transactions every interval when deviation/staleness triggers.

## Related documentation

- **[README.md](./README.md)** — behavior, oracle wallet setup, Docker, deploy checklist
- **[sparkl-solo/AGENTS.md](https://github.com/sparkl-network/sparkl-solo/blob/main/AGENTS.md)** — `launch-local.sh`, contract deploy
- **Contract:** [RateSetter.sol](https://github.com/sparkl-network/sparkl-solo/blob/main/contracts/src/RateSetter.sol)
