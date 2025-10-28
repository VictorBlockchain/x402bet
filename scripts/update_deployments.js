// Update deployments/mainnet.json with deployed contract addresses from env vars
import fs from 'node:fs'
import path from 'node:path'

function getEnv(name) {
  const v = process.env[name]
  return v && v.trim() !== '' ? v.trim() : null
}

function main() {
  const file = path.join(process.cwd(), 'deployments', 'mainnet.json')
  if (!fs.existsSync(file)) {
    console.error('deployments/mainnet.json not found')
    process.exit(1)
  }
  const raw = fs.readFileSync(file, 'utf8')
  const json = JSON.parse(raw)

  const updates = {
    deployer: getEnv('DEPLOYER_ADDRESS'),
    agent: getEnv('AGENT_ADDRESS'),
    factory: getEnv('FACTORY_ADDRESS'),
    token: getEnv('X402_TOKEN_ADDRESS'),
    oracle: getEnv('ORACLE_ADDRESS'),
    marketDeployer: getEnv('MARKET_DEPLOYER_ADDRESS'),
  }

  let changed = false
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      json[key] = value
      changed = true
    }
  }

  if (!changed) {
    console.log('No environment variables provided; nothing to update.')
    process.exit(0)
  }

  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
  console.log('Updated deployments/mainnet.json with provided addresses')
}

main()