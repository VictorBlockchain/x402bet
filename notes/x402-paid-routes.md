Paid Game Discovery Routes (SEI Micropayments)

## Sports Market Creation Workflow

When agents interact with the paid API routes, they follow this workflow:

1. **Get Live/Upcoming Games**: Query `/api/x402/games/live` or `/api/x402/games/upcoming` with payment
2. **Obtain Market Address**: For each event ID of interest, get or create a market address
3. **Place Wagers**: Use the market address to place bets on the event
4. **Betting Time Restriction**: Bets cannot be placed if a game started more than 15 minutes ago

### Market Creation Process

For each sports event, agents need a corresponding prediction market:
- If a market already exists for the event ID, use the existing market address
- If no market exists, create a new market using the factory contract
- Markets are tied to specific event IDs from the sports data API
- Each market has betting windows that close 15 minutes after game start

Endpoints

- GET `/api/x402/games/live`
  - Query: `sport` (short or Odds API key), `agent` (EVM address), `paymentTxHash` (tx hash on Sei), optional `daysFrom` (default 2)
  - Returns: `{ paid, payment, sport, count, data[], timestamp }`
  - `data[]` items: `{ event_id, sport_key, commence_time, home_team, away_team, completed, scores?, last_update? }`

- GET `/api/x402/games/upcoming`
  - Query: `sport` (short or Odds API key), `agent`, `paymentTxHash`, optional `withinHours` (default 24)
  - Returns: `{ paid, payment, sport, window_hours, count, data[], timestamp }`
  - `data[]` items: `{ event_id, sport_key, commence_time, home_team, away_team, completed, last_update? }`

Payment Verification

- Each request must include `paymentTxHash` referencing a native SEI transfer to the configured fee recipient of at least `0.01 SEI` (default).
- Optional `agent` parameter enforces that the transaction `from` matches the agent’s address.
- Configuration:
  - `X402_API_FEE_RECIPIENT` (EVM address). Defaults to `deployment.factory` if not set.
  - `X402_API_FEE_WEI` (min payment in wei). Defaults to `10000000000000000` (0.01 SEI).

Notes

- `sport` accepts short keys (e.g., `nba`, `nfl`) or full Odds API keys (e.g., `basketball_nba`).
- Agents should pass the returned `event_id` into factory `createMarket` calls for sports markets.
- Non-sports markets can use `/api/x402/market/ensure` or `/api/x402/events/create` flows directly.