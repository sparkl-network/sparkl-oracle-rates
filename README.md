# sparkl-oracle-rates

Off-chain DOT/USD price oracle for Sparkl. Fetches rates from public APIs (CoinGecko, Binance), aggregates with a median, and pushes to [`RateSetter`](https://github.com/sparkl-network/sparkl-solo/blob/main/contracts/src/RateSetter.sol) on a configurable interval.

## How it works

1. **Fetch** — Each tick calls every configured price source in parallel.
2. **Aggregate** — Successful quotes are combined into a median DOT/USD price.
3. **Convert** — Median is encoded as `usdcPerDot` (6 decimals) and `dotPerUsdc` (18-dec DOT per 1 USDC smallest unit), matching `RateSetter.setRate`.
4. **Push** — A dedicated oracle wallet sends `setRate` when:
   - the price moved more than `DEVIATION_THRESHOLD`, or
   - the on-chain rate is older than `MAX_STALENESS_MS` (align with `RateSetter.maxStaleness` at deploy time).

## Oracle wallet

The oracle runs as a normal EVM **externally owned account (EOA)**. That wallet is the only address allowed to call `RateSetter.setRate` (the on-chain `updater`). Every price push is a **paid transaction**: the wallet must hold enough **native token** (DOT on Paseo / Passet Hub EVM) to cover gas for each `setRate` call. If the balance is too low, ticks will fail when submitting transactions.

Use a **dedicated hot wallet** for the oracle service — not your deployer or personal funds wallet. Never commit `.env` or share the private key in chat, tickets, or git.

### 1. Create a new wallet

With [Foundry](https://book.getfoundry.sh/) installed:

```bash
cast wallet new oracle-updater
```

This prints a **mnemonic**, **address**, and **private key**. Store the mnemonic offline if you need recovery; for the service you only need the private key in `.env`.

To generate a key without a mnemonic label:

```bash
cast wallet new --json
```

Alternative (Node.js one-liner, no Foundry):

```bash
node -e "const {generatePrivateKey,privateKeyToAccount}=require('viem/accounts');const k=generatePrivateKey();console.log('address',privateKeyToAccount(k).address);console.log('ORACLE_PRIVATE_KEY',k)"
```

Run that from the repo directory after `yarn install` so `viem` is available.

### 2. Register the address on-chain

When deploying `RateSetter` (see `sparkl-solo/contracts/script/DeployPaseo.s.sol`), set the updater to this wallet **before** starting the oracle:

```bash
export ORACLE_UPDATER_ADDRESS=0xYourOracleWalletAddress
# then broadcast DeployPaseo with PRIVATE_KEY = deployer key
```

If `RateSetter` is already deployed, the **owner** must call `setUpdater(oracleAddress)` on the contract.

The address derived from `ORACLE_PRIVATE_KEY` must equal `RateSetter.updater`. Verify:

```bash
cast wallet address --private-key "$ORACLE_PRIVATE_KEY"
cast call "$RATE_SETTER_ADDRESS" "updater()(address)" --rpc-url "$EVM_RPC_URL"
```

### 3. Fund the wallet for gas

Send native DOT (or the chain’s gas token) to the oracle address on the same network as `EVM_RPC_URL`. How much depends on gas price and how often you push:

- At most one tx per `UPDATE_INTERVAL_MS` when price moves or staleness forces a push.
- Staleness recovery can add extra txs if the service was down.

Check balance:

```bash
ORACLE_ADDRESS=$(cast wallet address --private-key "$ORACLE_PRIVATE_KEY")
cast balance "$ORACLE_ADDRESS" --rpc-url "$EVM_RPC_URL"
```

On Paseo testnet, use the network faucet or team faucet process to fund the oracle address (same as any Hub EVM deploy account).

### 4. Add the private key to `.env`

```bash
cp .env.example .env
chmod 600 .env   # optional: restrict read access on the host
```

Edit `.env`:

```bash
EVM_RPC_URL=https://rpc.passet-hub.polkadot.io
RATE_SETTER_ADDRESS=0x...   # deployed RateSetter
ORACLE_PRIVATE_KEY=0x...    # 32-byte hex private key (66 chars with 0x prefix)
```

Rules for `ORACLE_PRIVATE_KEY`:

- Must start with `0x` and be **64 hex digits** after the prefix (32 bytes).
- Must be the key for the wallet configured as `RateSetter.updater`.
- Loaded only from the environment at process start (`loadConfig()` reads `process.env`). For Docker, pass `--env-file .env` and keep the file out of images (use secrets in production).

**Security:** `.env` is gitignored. Do not log the key. Rotate by deploying a new updater address (`setUpdater`) and updating `.env`, then draining/removing the old key.

### 5. Confirm pushes pay fees

After `yarn start`, a successful tick that submits on-chain logs something like:

```text
setRate tx confirmed: 0x... (block ...)
```

Each such line is one gas-paid transaction from the oracle wallet. Monitor `/health` (`lastPushAt`) and wallet balance; refill native token before the balance hits zero.

## Quick start

```bash
cp .env.example .env
# Complete "Oracle wallet" above: ORACLE_PRIVATE_KEY, RATE_SETTER_ADDRESS, fund for gas

yarn install
yarn build
yarn start
```

Dev (no build step):

```bash
yarn dev
```

Health check: `GET http://localhost:8090/health`

## Configuration

| Variable | Description |
|----------|-------------|
| `EVM_RPC_URL` | Hub EVM JSON-RPC endpoint |
| `RATE_SETTER_ADDRESS` | Deployed `RateSetter` contract |
| `ORACLE_PRIVATE_KEY` | Updater wallet (must match `RateSetter.updater`) |
| `UPDATE_INTERVAL_MS` | Poll interval (default `300000` = 5 min) |
| `DEVIATION_THRESHOLD` | Min relative move to push (default `0.005` = 0.5%) |
| `MAX_STALENESS_MS` | Force push if chain rate is older (default 1h) |
| `PRICE_SOURCES` | Comma-separated: `coingecko`, `binance` |
| `HEALTH_PORT` | HTTP port for `/health` (default `8090`) |
| `COINGECKO_API_KEY` | Optional CoinGecko demo API key |

## Docker

```bash
docker build -t sparkl-oracle-rates .
docker run --env-file .env sparkl-oracle-rates
```

## Deploy checklist

1. Create oracle wallet (`cast wallet new`) — see **Oracle wallet**.
2. Deploy `RateSetter` with `updater` = that address (`ORACLE_UPDATER_ADDRESS`) and `maxStaleness` = `MAX_STALENESS_MS / 1000` seconds.
3. Fund the oracle wallet with native DOT for gas on the Hub EVM.
4. Set `RATE_SETTER_ADDRESS` and `ORACLE_PRIVATE_KEY` in `.env` (never commit).
5. Confirm `/health` shows `lastPushAt` after the first successful tick.

## Related

- Contract: `sparkl-solo/contracts/src/RateSetter.sol`
- Paseo deploy: `sparkl-solo/contracts/script/DeployPaseo.s.sol`
