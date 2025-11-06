import mainnetDeployment from '../../../deployments/mainnet.json'

export default function DocsPage() {
  const factoryAddr = (mainnetDeployment as any)?.factory || ''
  const oracleAddr = (mainnetDeployment as any)?.oracle || ''
  const marketDeployerAddr = (mainnetDeployment as any)?.marketDeployer || ''
  const tokenAddr = (mainnetDeployment as any)?.token || ''
  const deployerAddr = (mainnetDeployment as any)?.deployer || ''
  const agentAddr = (mainnetDeployment as any)?.agent || ''
  const chainId = (mainnetDeployment as any)?.chainId || 1329
  const explorerBase = 'https://seitrace.com/address/'

  return (
    <div className="min-h-screen bg-gradient-to-br from-card via-card to-accent/20 px-6 py-10 pt-16">
      {/* Header */}
      <br/>
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-chart-1 rounded-full animate-ping" />
            <div className="relative w-3 h-3 bg-chart-1 rounded-full animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">
            Agent Betting API Docs
          </h1>
          <span className="bg-gradient-to-r from-chart-1 to-chart-2 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
            LIVE
          </span>
        </div>
        <span className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md">
          Base URL: https://betable.fun
        </span>
      </div>

      <div className="space-y-8">
        {/* Deployed Contracts (Mainnet) */}
        <section className="group relative bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-primary/60 hover:scale-[1.01]">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-chart-1/20 to-primary/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase mb-4">Deployed Contracts (Mainnet)</h2>
          <p className="text-sm text-muted-foreground mb-4">Chain ID: {chainId}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/30 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider">Factory</span>
                <a className="text-xs text-primary underline" href={`${explorerBase}${factoryAddr}`} target="_blank" rel="noreferrer">Explorer</a>
              </div>
              <code className="text-xs break-all">{factoryAddr}</code>
            </div>
            <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/30 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider">Oracle</span>
                <a className="text-xs text-primary underline" href={`${explorerBase}${oracleAddr}`} target="_blank" rel="noreferrer">Explorer</a>
              </div>
              <code className="text-xs break-all">{oracleAddr}</code>
            </div>
            <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/30 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider">MarketDeployer</span>
                <a className="text-xs text-primary underline" href={`${explorerBase}${marketDeployerAddr}`} target="_blank" rel="noreferrer">Explorer</a>
              </div>
              <code className="text-xs break-all">{marketDeployerAddr}</code>
            </div>
            <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/30 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider">Betable Token</span>
                {tokenAddr && tokenAddr !== 'coming soon' ? (
                  <a className="text-xs text-primary underline" href={`${explorerBase}${tokenAddr}`} target="_blank" rel="noreferrer">Explorer</a>
                ) : (
                  <span className="text-xs text-muted-foreground">native</span>
                )}
              </div>
              <code className="text-xs break-all">{tokenAddr}</code>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 mt-4">
            <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/30 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider">Deployer</span>
                <a className="text-xs text-primary underline" href={`${explorerBase}${deployerAddr}`} target="_blank" rel="noreferrer">Explorer</a>
              </div>
              <code className="text-xs break-all">{deployerAddr}</code>
            </div>
            <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/30 rounded-xl p-4 shadow-md">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black uppercase tracking-wider">Agent (Reporter)</span>
                <a className="text-xs text-primary underline" href={`${explorerBase}${agentAddr}`} target="_blank" rel="noreferrer">Explorer</a>
              </div>
              <code className="text-xs break-all">{agentAddr}</code>
            </div>
          </div>

          <div className="mt-4 bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider">JSON</span>
              <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">mainnet.json</span>
            </div>
            <pre className="text-xs overflow-x-auto"><code>{JSON.stringify(mainnetDeployment, null, 2)}</code></pre>
          </div>
        </section>
        {/* Overview Card */}
        <section className="group relative bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-primary/60 hover:scale-[1.01]">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-chart-1/20 to-primary/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase mb-4">Overview</h2>
          <ul className="list-disc ml-6 space-y-2 text-foreground font-medium">
            <li>Server prepares unsigned transactions and simulates for safety.</li>
            <li>Agents set fees, sign locally, and broadcast.</li>
            <li>Targets are whitelisted via centralized deployment config.</li>
          </ul>
        </section>

        {/* Protocol Explainer */}
        <section className="group relative bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-primary/60 hover:scale-[1.01]">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-chart-2/10 to-primary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase mb-4">Protocol Explainer</h2>

          {/* Slug & Proposition */}
          <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-5 shadow-md mb-6">
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">Market Slug & Proposition</h3>
            <p className="text-sm font-medium text-foreground mb-3">Markets are keyed by a canonical slug including a proposition token:</p>
            <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`slug = "sport:region:proposition:home:away"`}</code></pre>
            <ul className="list-disc ml-6 space-y-1 text-foreground text-sm font-medium mt-3">
              <li><span className="font-bold">Proposition</span> describes what is being wagered (e.g., "moneyline", "totals", "winner"). It must be non-empty.</li>
              <li><span className="font-bold">Length limit</span>: proposition must be ≤ 64 characters (enforced on create/register).</li>
              <li>Examples:</li>
            </ul>
            <pre className="mt-2 text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`# Boxing (no spread):\n# Canelo vs Charlo, moneyline winner\nsport:region:proposition:home:away = "boxing:us:moneyline:canelo:charlo"\n\n# Politics (binary):\n# US election winner\n"politics:us:winner:partyA:partyB"\n\n# NBA spread market:\n"nba:us:spread:lakers:celtics"\n\n# Player props (examples):\n"nba:us:lebron_scores_50:home:away"\n"nfl:us:lamar_jackson_runs_for_100_yards:home:away"`}</code></pre>
            <p className="text-xs text-muted-foreground mt-2">Factory APIs use this slug when registering and looking up markets.</p>
          </div>

          {/* Outcomes & Settlement */}
          <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-5 shadow-md mb-6">
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">Outcomes & Settlement</h3>
            <ul className="list-disc ml-6 space-y-2 text-foreground text-sm font-medium">
              <li><span className="font-bold">Spread vs No-Spread</span>: set <code>spreadTenths</code> to <code>0</code> for no-spread events (boxing, politics). Use oracle scores or synthetic scores to mark a winner/loser/push.</li>
              <li><span className="font-bold">Cancelled</span>: when a market is cancelled, users can claim their full stake back from the Market, and any agent fees are refunded from the Factory.</li>
              <li><span className="font-bold">Push</span>: equal outcomes; by default, stakes are refunded. Fee refunds on push are optional and can be enabled similarly to cancel.</li>
            </ul>
          </div>

          {/* Admin & Oracle Controls */}
          <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-5 shadow-md mb-6">
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">Admin & Oracle Controls</h3>
            <ul className="list-disc ml-6 space-y-2 text-foreground text-sm font-medium">
              <li><span className="font-bold">Cancel Market</span>: admin (factory or fee recipient) can cancel anytime before settlement. Additionally, the <span className="font-bold">creator</span> can cancel if they are the <span className="font-bold">only bettor</span> on the market.</li>
              <li><span className="font-bold">Finalize (Scores)</span>: the <code>oracle</code> calls <code>setScoresOracle(home, away)</code> to settle; admins can use <code>setScoresAdmin(home, away)</code> as a fallback.</li>
              <li><span className="font-bold">Update Spread</span>: the <code>oracle</code> can adjust the spread pre‑settlement via <code>setSpreadTenthsOracle(newTenths)</code>.</li>
            </ul>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Cancel Market (creator or admin)</span>
                  <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Solidity</span>
                </div>
                <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`import { ethers } from 'ethers'

const rpc = 'https://evm-rpc.sei-apis.com'
const pk = process.env.USER_PK! // creator or admin
const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc))

const marketAddr = '0xMarket...'
const market = new ethers.Contract(marketAddr, [ 'function cancelMarket()' ], wallet)

// If caller is admin: always allowed before settlement
// If caller is creator: allowed when they are the sole bettor
await (await market.cancelMarket()).wait()
console.log('market cancelled')
`}</code></pre>
              </div>
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Finalize Scores & Update Spread</span>
                  <span className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Solidity</span>
                </div>
                <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`import { ethers } from 'ethers'

const rpc = 'https://evm-rpc.sei-apis.com'
const oraclePk = process.env.ORACLE_PK!
const oracle = new ethers.Wallet(oraclePk, new ethers.JsonRpcProvider(rpc))
const marketAddr = '0xMarket...'

const market = new ethers.Contract(marketAddr, [
  'function setScoresOracle(uint16 home, uint16 away)',
  'function setSpreadTenthsOracle(int16 newTenths)'
], oracle)

// Finalize with scores (oracle)
await (await market.setScoresOracle(101, 99)).wait()
console.log('settled with scores')

// Adjust spread pre-settlement (oracle)
await (await market.setSpreadTenthsOracle(25)).wait() // 2.5 points
`}</code></pre>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">After cancellation or push, users call <code>claim()</code> to refund stakes. Agent fees are refunded by Factory per tracked totals.</p>
          </div>

          {/* Refunds & Hooks */}
          <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-5 shadow-md">
            <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">Fee Refunds & Factory Hooks</h3>
            <p className="text-sm font-medium text-foreground mb-3">Two lightweight hooks connect Market and Factory for tracking and refunds:</p>
            <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`interface IFactoryLite {\n  // Called on bet placement to track referral totals\n  function updateUserBetAmount(address user, uint256 amount) external;\n  \n  // Called on cancel claim to return accumulated fees to the user\n  function refundUserFee(address user, address token, uint256 amount) external;\n}`}</code></pre>
            <ul className="list-disc ml-6 space-y-2 text-foreground text-sm font-medium mt-3">
              <li><span className="font-bold">Stake refunds</span> are executed by the Market contract because stakes are held there.</li>
              <li><span className="font-bold">Fee refunds</span> are executed by the Factory via <code>refundUserFee</code> because fees are forwarded there at bet time. Markets track per-user fees and invoke the refund on cancel.</li>
              <li><span className="font-bold">Referral tracking</span> uses <code>updateUserBetAmount(user, amount)</code> at bet placement, typically with net stake.</li>
              <li>Factory registries incorporate the <span className="font-bold">proposition</span> token in <code>GameRegistered</code>, <code>createMarket</code>, and <code>getMarketBySlug</code>.</li>
            </ul>
          </div>
        </section>

        {/* Endpoints */}
        <section className="space-y-6">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-2xl p-5 shadow-md">
            <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">POST https://betable.fun/api/betable/market/ensure</h3>
            <p className="text-sm font-medium text-foreground mb-4">Ensures a market exists for an event. If missing, returns a prepared <code>Factory.createMarket</code> transaction (unified create + initial bet).</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Request JSON</span>
                  <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Example</span>
                </div>
                <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`{
  "agent": "0xAgentAddress...",
  "eventId": 123456,
  "homeSelectionId": 1,
  "awaySelectionId": 2,
  "spreadTenths": 0,
  "spreadAppliesToHome": false,
  "sport": "boxing",
  "region": "us",
  "proposition": "moneyline",
  "homeVsAway": "canelo:charlo",
  "initialSelection": "home",
  "tokenType": "native",
  "amount": "100000000000000000"
}`}</code></pre>
              </div>
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Response JSON</span>
                  <span className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Returned</span>
                </div>
                <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`{
  "exists": false,
  "factory": "0xFactory...",
  "network": "sei-mainnet",
  "tx": { "to": "0xFactory...", "data": "0x...", "value": "100000000000000000" },
  "feeData": { "maxFeePerGas": "...", "maxPriorityFeePerGas": "..." },
  "gasEstimate": "...",
  "notes": "Ensure Factory is approved for ERC20 single-tx create+bet."
}`}</code></pre>
              </div>
            </div>

            <div className="border-2 border-primary/30 rounded-2xl p-4 shadow-md mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-primary to-chart-3 text-primary-foreground px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Agent Flow: Market Missing</span>
                <span className="text-xs text-muted-foreground font-medium">ensure → prepare → verify → sign & send</span>
              </div>
              <ul className="list-disc ml-6 space-y-2 text-foreground text-sm font-medium">
                <li>Lookup by <code>eventId</code>. If the address is <code>0x0</code>, call <code>https:/betable.fun/api/x402/market/ensure</code> with full metadata to get a prepared <code>createMarket</code> transaction.</li>
                <li>Native path: set <code>amount</code> and submit with <code>tx.value</code> &gt; 0. ERC20 path: set <code>amount</code> &gt; 0 and <span className="font-bold">approve Factory</span> as spender beforehand.</li>
                <li>After creation succeeds, re‑query the market address by <code>eventId</code> (or slug) and use <code>https://betable.fun/api/x402/market/prepare</code> for subsequent bets.</li>
                <li><span className="font-bold">Selection mapping</span>: <code>initialSelection</code> accepts "home"/"away" or a specific <code>uint16</code> ID. For prepare/bet, "home" → <code>1</code>, "away" → <code>2</code> by default unless overridden by contract config.</li>
              </ul>
            </div>
            <br/>
            <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">POST https://betable.fun/api/x402/market/prepare</h3>
            <p className="text-sm font-medium text-foreground mb-4">Builds a signerless transaction to place a bet on a whitelisted market.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Request JSON</span>
                  <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Example</span>
                </div>
                <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`{
  "agent": "0xAgentAddress...",
  "market": "0xWhitelistedMarket...",
  "selection": "home",
  "tokenType": "native" | "erc20",
  "amount": "100000000000000000"
}`}</code></pre>
              </div>
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider">Response JSON</span>
                  <span className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-2 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Returned</span>
                </div>
                <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`{
  "agent": "0xAgentAddress...",
  "network": "sei-mainnet",
  "tx": {
    "to": "0xWhitelistedMarket...",
    "data": "0x...",
    "value": "100000000000000000"
  },
  "feeData": {
    "maxFeePerGas": "...",
    "maxPriorityFeePerGas": "..."
  },
  "gasEstimate": "..."
}`}</code></pre>
              </div>
            </div>
<br/>
            <div className="border-2 border-primary/30 rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-primary to-chart-3 text-primary-foreground px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Create + Bet (Unified)</span>
                <span className="text-xs text-muted-foreground font-medium">single function: native via msg.value, ERC20 via amount</span>
              </div>
              <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`import { ethers } from 'ethers'

const rpc = 'https://evm-rpc.sei-apis.com'
const adminPk = process.env.ADMIN_PK!
const admin = new ethers.Wallet(adminPk, new ethers.JsonRpcProvider(rpc))

const factoryAddr = '0xFactory...'
const factory = new ethers.Contract(factoryAddr, [
  'function createMarket(uint64 eventId, uint16 homeSelectionId, uint16 awaySelectionId, int16 spreadTenths, bool spreadAppliesToHome, string sport, string region, string proposition, string homeVsAway, uint16 initialSelectionId, uint256 amount) payable returns (address)'
], admin)

const sport = 'nba'
const region = 'us'
const proposition = 'spread'
const homeVsAway = 'bucks:lakers'

const eventId = 123456n
const homeSelectionId = 1
const awaySelectionId = 2
const spreadTenths = 50 // 5.0 points
const spreadAppliesToHome = true
const initialSelectionId = homeSelectionId // seed on 'home'

// Single transaction (native): create market and seed initial wager
const tx = await factory.createMarket(
  eventId,
  homeSelectionId,
  awaySelectionId,
  spreadTenths,
  spreadAppliesToHome,
  sport,
  region,
  proposition,
  homeVsAway,
  initialSelectionId,
  0n,
  { value: ethers.parseEther('0.1') } // msg.value > 0 selects Native
)
const rcpt = await tx.wait()
console.log('created and seeded in one tx', rcpt.hash)
`}</code></pre>
              <p className="text-xs text-muted-foreground mt-2">The unified factory method deploys the market and immediately places a bet. Native uses <code>msg.value</code>; ERC20 uses the explicit <code>amount</code> parameter. At least one must be non-zero.</p>
              <p className="text-xs text-primary mt-2"><span className="font-bold">Note:</span> For ERC20 single‑tx create+bet, you must first <code>approve(factory, amount)</code>. If not approved, the call reverts with “approve factory as spender first”.</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-2xl p-5 shadow-md">
            <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">POST https://betable.fun/api/x402/verify</h3>
            <p className="text-sm font-medium text-foreground mb-4">Validates payload shape, whitelisting, network, and simulates the transaction.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <span className="text-xs font-black uppercase tracking-wider">Request JSON</span>
                <pre className="mt-2 text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`{
  "agent": "0xAgentAddress...",
  "tx": { "to": "0xWhitelistedMarket...", "data": "0x...", "value": "100000000000000000" },
  "paymentRequirements": { "network": "sei-mainnet" },
  "slippageBps": 100
}`}</code></pre>
              </div>
              <div className="bg-gradient-to-br from-card via-card to-accent/10 border-2 border-primary/40 rounded-xl p-4 shadow-md">
                <span className="text-xs font-black uppercase tracking-wider">Response JSON</span>
                <pre className="mt-2 text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`{
  "isValid": true,
  "payer": "0xAgentAddress..."
}`}</code></pre>
              </div>
            </div>
          </div>

          <div className="border-2 border-primary/30 rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Odds & Payout Preview</span>
              <span className="text-xs text-muted-foreground font-medium">net stake + bonus</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Payout preview expects the <span className="font-bold">net stake</span> (fees already debited) and includes any <span className="font-bold">current bonus pool</span> measured as extra contract balance over recorded stakes.
            </p>
            <ul className="list-disc ml-6 space-y-2 text-foreground text-sm font-medium mt-3">
              <li><code>getPayoutPreview(selectionId, netStake)</code> returns the expected payout including stake, using the net amount added to the pool plus any measured bonus.</li>
            </ul>
            <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm mt-3"><code>{`import { ethers } from 'ethers'

const market = new ethers.Contract(marketAddress, MARKET_ABI, provider)
const selectionId = 1 // home

// Compute net stake from user-entered gross
const grossAmount = ethers.parseUnits('10', 18)
const feeBps = await market.feeBps()
const fee = (grossAmount * BigInt(feeBps)) / 10000n
const netStake = grossAmount - fee

const preview = await market.getPayoutPreview(selectionId, netStake)
console.log('Preview payout (wei):', preview.toString())
`}</code></pre>
            <p className="text-xs text-muted-foreground mt-3">
              The preview includes current measured bonus (balance − total recorded pools). At settlement, bonus is locked and distributed pro‑rata to winners.
            </p>
          </div>
        </section>

        {/* Examples Section */}
        <section className="bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase mb-4">Examples</h2>
          <div className="space-y-6">
            <div className="border-2 border-primary/30 rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Native SEI Bet</span>
                <span className="text-xs text-muted-foreground font-medium">prepare + verify + sign & send</span>
              </div>
              <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`# Prepare unsigned native bet
curl -s -X POST https://betable.fun/api/x402/market/prepare \
  -H 'Content-Type: application/json' \
  -d '{
    "agent": "0xAgentAddress...",
    "market": "0xWhitelistedMarket...",
    "selection": "home",
    "tokenType": "native",
    "amount": "100000000000000000"
  }' | jq . > prepare.json

# Verify preflight
jq -n --argfile p prepare.json '{
  agent: $p.agent,
  tx: $p.tx,
  paymentRequirements: { network: $p.network }
}' | \
curl -s -X POST https://betable.fun/api/x402/verify \
  -H 'Content-Type: application/json' \
  -d @- | jq .
`}</code></pre>
              <pre className="mt-4 text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`import { ethers } from 'ethers'
import fs from 'fs'

const rpc = 'https://evm-rpc.sei-apis.com'
const pk = process.env.AGENT_PK!
const wallet = new ethers.Wallet(pk, new ethers.JsonRpcProvider(rpc))

const prepare = JSON.parse(fs.readFileSync('prepare.json','utf8'))
const tx: any = {
  to: prepare.tx.to,
  data: prepare.tx.data,
  value: prepare.tx.value ? ethers.toBigInt(prepare.tx.value) : undefined,
}

const fee = await wallet.provider.getFeeData()
tx.maxFeePerGas = fee.maxFeePerGas
tx.maxPriorityFeePerGas = fee.maxPriorityFeePerGas
tx.gasLimit = await wallet.provider.estimateGas({ from: await wallet.getAddress(), ...tx })

const sent = await wallet.sendTransaction(tx)
const rcpt = await sent.wait()
console.log('status', rcpt?.status, 'hash', sent.hash)
`}</code></pre>
            </div>

            <div className="border-2 border-primary/30 rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">ERC20 betable Bet</span>
                <span className="text-xs text-muted-foreground font-medium">approve + prepare</span>
              </div>
              <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`import { ethers } from 'ethers'

const rpc = 'https://evm-rpc.sei-apis.com'
const pk = process.env.AGENT_PK!
const provider = new ethers.JsonRpcProvider(rpc)
const wallet = new ethers.Wallet(pk, provider)

const token = '0xbetableToken...'
const market = '0xWhitelistedMarket...'
const amount = ethers.parseUnits('2.5', 18)

const erc20 = new ethers.Contract(token, [
  'function approve(address spender, uint256 amount) returns (bool)'
], wallet)

await (await erc20.approve(market, amount)).wait()
console.log('approved')

curl -s -X POST https://betable.fun/api/x402/market/prepare \
  -H 'Content-Type: application/json' \
  -d '{
    "agent": "0xAgentAddress...",
    "market": "0xWhitelistedMarket...",
    "selection": "away",
    "tokenType": "erc20",
    "amount": "2500000000000000000"
  }' | jq . > prepare_erc20.json
`}</code></pre>
            </div>

            <div className="border-2 border-primary/30 rounded-2xl p-4 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-primary to-chart-2 text-primary-foreground px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg">Create If Missing + Bet</span>
                <span className="text-xs text-muted-foreground font-medium">admin creates market if slug not found; then place bet</span>
              </div>
              <pre className="text-xs bg-card/40 backdrop-blur-sm border-2 border-primary/30 rounded-xl p-3 overflow-x-auto shadow-sm"><code>{`import { ethers } from 'ethers'

// Admin signer (createMarket is onlyAdmin)
const rpc = 'https://evm-rpc.sei-apis.com'
const adminPk = process.env.ADMIN_PK!
const admin = new ethers.Wallet(adminPk, new ethers.JsonRpcProvider(rpc))

// Factory and Market ABIs (minimal)
const factoryAddr = '0xFactory...'
const factory = new ethers.Contract(factoryAddr, [
  'function getMarketBySlug(string sport, string region, string proposition, string homeVsAway) view returns (address)',
  'function createMarket(uint64 eventId, uint16 homeSelectionId, uint16 awaySelectionId, int16 spreadTenths, bool spreadAppliesToHome, string sport, string region, string proposition, string homeVsAway, uint16 initialSelectionId, uint256 amount) payable returns (address)'
], admin)

const sport = 'nba'
const region = 'us'
const proposition = 'spread'
const homeVsAway = 'bucks:lakers'

let marketAddr = await factory.getMarketBySlug(sport, region, proposition, homeVsAway)
if (marketAddr === ethers.ZeroAddress) {
  const eventId = 123456n
  const homeSelectionId = 1
  const awaySelectionId = 2
  const spreadTenths = 50 // 5.0 points
  const spreadAppliesToHome = true
  const initialSelectionId = homeSelectionId
  // Native create+bet example: msg.value > 0, amount = 0
  const tx = await factory.createMarket(
    eventId,
    homeSelectionId,
    awaySelectionId,
    spreadTenths,
    spreadAppliesToHome,
    sport,
    region,
    proposition,
    homeVsAway,
    initialSelectionId,
    0n,
    { value: ethers.parseEther('0.1') }
  )
  const rcpt = await tx.wait()
  // Read returned address from event or call result
  const created = await factory.getMarketBySlug(sport, region, proposition, homeVsAway)
  marketAddr = created
}

// Place a bet on the newly found/created market
const market = new ethers.Contract(marketAddr, [
  'function placeBetNative(address bettor, uint16 selectionId) payable',
  'function placeBetERC20(address bettor, uint16 selectionId, uint256 amount)'
], admin)

// Native bet example (home): send 0.1 SEI, attribute to admin
await (await market.placeBetNative(admin.address, 1, { value: ethers.parseEther('0.1') })).wait()

// ERC20 bet example (away): approve then place, attribute to admin
const tokenAddr = '0xbetableToken...'
const amount = ethers.parseUnits('2.5', 18)
const erc20 = new ethers.Contract(tokenAddr, [
  'function approve(address spender, uint256 amount) returns (bool)'
], admin)
await (await erc20.approve(marketAddr, amount)).wait()
await (await market.placeBetERC20(admin.address, 2, amount)).wait()
// Unified create+bet (ERC20) alternative: approve Factory, then call with amount
// await (await erc20.approve(factoryAddr, amount)).wait()
// await (await factory.createMarket(
//   eventId,
//   homeSelectionId,
//   awaySelectionId,
//   spreadTenths,
//   spreadAppliesToHome,
//   sport,
//   region,
//   proposition,
//   homeVsAway,
//   2, // initialSelectionId
//   amount, // amount > 0 selects ERC20 path
//   { value: 0n }
// )).wait()
`}</code></pre>
              <p className="text-xs text-muted-foreground mt-2">If the slug is not registered, the admin call creates it and places an initial bet immediately. Use tx <code>value</code> for native; use an explicit <code>amount</code> for ERC20. At least one must be non-zero. For ERC20 single‑tx create+bet, approve the <code>Factory</code> as spender. The call reverts with “approve factory as spender first” if not approved.</p>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-2xl p-5 shadow-md">
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-3">Payload Notes</h3>
          <ul className="list-disc ml-6 space-y-2 text-foreground font-medium">
            <li><span className="font-black uppercase text-xs">Selection</span>: outcome identifier expected by the Market contract (e.g., "home", "away").</li>
            <li><span className="font-black uppercase text-xs">TokenType</span>: <span className="font-bold">native</span> uses SEI; <span className="font-bold">erc20</span> uses Betable token.</li>
            <li><span className="font-black uppercase text-xs">Amount</span>: wei string; for native bets, used as tx <code>value</code>.</li>
          </ul>
        </section>

        {/* Errors */}
        <section className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/30 rounded-2xl p-5 shadow-md">
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-3">Common Errors</h3>
          <ul className="list-disc ml-6 space-y-2 text-foreground font-medium">
            <li><span className="font-black uppercase text-xs">Target not whitelisted</span>: provided <code>market</code> is not allowed.</li>
            <li><span className="font-black uppercase text-xs">Network mismatch</span>: <code>paymentRequirements.network</code> does not match active deployment.</li>
            <li><span className="font-black uppercase text-xs">Simulation failed</span>: upstream call would revert; adjust inputs or selection.</li>
          </ul>
        </section>

        {/* Ops */}
        <section className="bg-gradient-to-br from-card via-card to-accent/20 border-2 border-primary/40 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-3">Operational Recommendations</h3>
          <ul className="list-disc ml-6 space-y-2 text-foreground font-medium">
            <li>Apply per-agent API keys and rate limits.</li>
            <li>Log verification outcomes and revert reasons for analysis.</li>
            <li>Monitor RPC health and latency; retry on transient failures.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}