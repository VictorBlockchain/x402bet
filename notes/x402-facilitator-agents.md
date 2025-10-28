X402 Facilitator: Ideal Setup for AI Agents

Goals

- Prepare safe, unsigned transactions server-side; require agent-side signing.
- Centralize network, contract addresses, and policy in deployment config.
- Validate payloads, whitelist contract targets, simulate calls, and gate settlement.

Key Principles

- Signerless prepare: API routes return `to`, `data`, `value`, gas estimates, and fee data.
- Agent as payer: The `agent` address in the payload must sign and send.
- Whitelisting: Only allow calls to contracts listed in `getDeployment()`.
- Network alignment: Require `paymentRequirements.network` to match active deployment.
- Simulation-first: Use `provider.call` to preflight and catch obvious reverts.

Required Agent Signing

- Server never holds private keys; no server-side `sendTransaction`.
- Agents fetch prepared tx, set final `gas`, `maxFeePerGas`, `maxPriorityFeePerGas`, and sign.
- Agent signer address must equal `payload.agent` to pass settlement safety checks.

Verification Flow (Server)

- Validate payload shape: `{ agent, tx: { to, data, value? }, slippageBps? }`.
- Check `tx.to` checksummed and whitelisted.
- Optional: bound `slippageBps` (e.g., 0–500 bps).
- Simulate with `provider.call` and return `{ isValid, payer }`.

Settlement Flow (Server)

- Confirm network match and payload validity.
- Ensure signer address equals `payload.agent`.
- Re-simulate for safety; block if revert is detected.
- Broadcast only if all checks pass, return `{ success, transaction, network, payer, errorReason? }`.

Payload Shape (Typical)

- `agent`: EVM address of the payer/signer.
- `tx`: `{ to, data, value?, gas?, maxFeePerGas?, maxPriorityFeePerGas? }`.
- Optional: `slippageBps` for swap flows; enforced if provided.

Security Controls

- Address whitelist: derive from `getDeployment()` contract addresses.
- Input guards: require valid checksummed addresses and calldata strings.
- Network gating: reject mismatched `paymentRequirements.network`.
- Simulation gate: reject transactions that revert during call.
- Signer equality: signer must match `agent` exactly.

Operational Recommendations

- Logging: record verification decisions, simulation errors, and settlement outcomes.
- Metrics: track success rate, revert reasons, latency, and fee stats.
- Rate limits: protect endpoints from abuse; prioritize agent API keys.
- Monitoring: alerts on simulation spikes, settlement failures, and RPC health.

Example Agent Steps

- POST to signerless API (e.g., `/api/x402/amm/swap`, `/api/x402/bag/swap`, `/api/x402/market/buy|list`) to obtain prepared tx.
- Verify `network`, `to`, and `data` and set fee params (`gas`, `maxFeePerGas`, `maxPriorityFeePerGas`).
- Sign with the agent wallet, then submit using `sendTransaction`.
- Await receipt, check `status`, and handle errors using returned `errorReason`.

Why This Design

- Minimizes server risk by removing key custody and signing.
- Provides consistent safety checks via whitelisting and simulation.
- Keeps agents fully in control of transaction fees and timing.

## Oracle Settlement (Address-Only)

- Markets are identified by address; `eventId` is not required for settlement.
- Binary proposition mapping:
  - Home = True (Yes), Away = False (No)
  - Encode True as `[homeScore=1, awayScore=0]`
  - Encode False as `[homeScore=0, awayScore=1]`
- Server route for settlement: `POST /api/x402/oracle/settle`
  - Request payload: `{ marketAddress: "0x...", scores: [homeScore, awayScore] }`
  - Flow: server verifies reporter authorization → calls `reportScoreForMarket(market, home, away)` → market settles.
- Querying status:
  - `GET /api/x402/oracle/settle?market=0x...` returns `{ isSettled, homeScore, awayScore }`.
- Example slug → teams → mapping:
  - `nba:us:lebron_scores_50:lakers:bucks` → Home=`lakers` (True), Away=`bucks` (False).
