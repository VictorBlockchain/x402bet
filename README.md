## x402bet

Production-ready Next.js app with on-chain sports prediction markets. Includes Hardhat contracts, paid API routes, Supabase persistence, and an Oracle for settlement.

### Prerequisites
- Node 18+
- Supabase project with `schema.sql` applied
- EVM RPC for the deployed contracts (local Hardhat or testnet)
- Environment variables in `.env.local`:
  - `ODDS_API_KEY` (The Odds API key)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `AGENT_PRIVATE_KEY` (authorized oracle reporter)
  - Optional: `SEI_RPC_URL`, `CHAIN_ID`

### Development
- `npm run dev` starts Next.js at `http://localhost:3000`.
- Use `scripts/deploy.js` to deploy local contracts and write to `deployments/local.json`.
- Do not commit secrets; `.env*`, keys, and Hardhat artifacts are ignored by `.gitignore`.

### x402 API Routes
- `POST /api/x402/market/ensure`
  - Ensures a market exists; returns prepared `createMarket` tx if missing.
  - Body: `agent, eventId, homeSelectionId, awaySelectionId, spreadTenths, spreadAppliesToHome, sport, region, proposition, homeVsAway, startTime?, cutoffTime?, initialSelection, tokenType, amount`.
- `POST /api/x402/market/prepare`
  - Prepares a `placeBet` tx for an existing market (native or ERC20).
  - Body: `agent, market, selection, tokenType, amount`.
- `POST /api/x402/oracle/settle`
  - Authorized reporter settles a market by reporting final scores.
  - Body: `marketAddress, scores: [home, away]`.
- `GET /api/x402/games/upcoming?sport=...&withinHours=...`
  - Paid route; requires `paymentTxHash` micropayment.
  - Returns upcoming events via The Odds API.
- `GET /api/x402/games/live?sport=...`
  - Paid route; requires `paymentTxHash`.
  - Returns live events and updates `x402_markets` with current odds snapshot.
- `POST /api/x402/games/finalize`
  - Fetches official scores for an `eventId` and validates completion.
  - Body: `eventId`.
- `POST /api/x402/transactions/sync`
  - Parses on-chain tx logs to upsert `x402_events.metadata` and `x402_markets` rows.
  - Body: `txHash`.

### Slug Normalization
- Canonical format: `sport:region:proposition:home:away`.
- Segments are lowercased, spaces → hyphens, punctuation removed.
- Example: `basketball_nba:us:spreads:los-angeles-lakers:boston-celtics`.

### Oracle & Settlement
- Address-first settlement; `reportScoreForMarket(address, uint16, uint16)` settles immediately.
- Binary mapping: Home=`True`, Away=`False`.
- Score encoding: True → `[1,0]`, False → `[0,1]`.

### Production Notes
- Ensure `AGENT_PRIVATE_KEY` is set for oracle settlement; remove any dev fallbacks.
- ODDS API must be configured; mock endpoints/data are removed in production.
- Verify micropayments via `verifySeiPayment`; configure network/rpc in `deployments/*.json`.
