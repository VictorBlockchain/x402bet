// Finalize mainnet deployment: configure factory with marketDeployer and oracle
import fs from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'

function reqEnv(name) {
  const v = process.env[name]
  if (!v || v.trim() === '') throw new Error(`Missing required env: ${name}`)
  return v.trim()
}

function loadArtifact(relPath) {
  const p = path.join(process.cwd(), 'artifacts', 'evm', 'contracts', relPath)
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw)
}

async function main() {
  // Load from .env.local if present (does not overwrite existing env)
  const p = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue
      const idx = line.indexOf('=')
      const key = line.slice(0, idx).trim()
      let val = line.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  }
  const RPC_URL = process.env.MAINNET_RPC_URL || 'https://evm-rpc.sei-apis.com'
  const PRIVATE_KEY = reqEnv('MAINNET_PRIVATE_KEY')
  const FACTORY_ADDRESS = reqEnv('FACTORY_ADDRESS')
  const MARKET_DEPLOYER_ADDRESS = reqEnv('MARKET_DEPLOYER_ADDRESS')
  const ORACLE_ADDRESS_ENV = process.env.ORACLE_ADDRESS || null
  const AGENT_ADDRESS = process.env.AGENT_ADDRESS || null

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  const factoryArt = loadArtifact(path.join('Factory.sol', 'X402BetFactory.json'))
  const oracleArt = loadArtifact(path.join('Oracle.sol', 'Oracle.json'))

  const factory = new ethers.Contract(FACTORY_ADDRESS, factoryArt.abi, wallet)

  // Set market deployer with explicit gas limit to avoid estimate issues
  await (await factory.setMarketDeployer(MARKET_DEPLOYER_ADDRESS, { gasLimit: 250000 })).wait()
  console.log('Factory configured: marketDeployer ->', MARKET_DEPLOYER_ADDRESS)

  // Ensure oracle
  let oracleAddr = ORACLE_ADDRESS_ENV
  if (!oracleAddr || oracleAddr === ethers.ZeroAddress) {
    const Oracle = new ethers.ContractFactory(oracleArt.abi, oracleArt.bytecode, wallet)
    const oracle = await Oracle.deploy(FACTORY_ADDRESS, { gasLimit: 3000000 })
    console.log('Oracle tx:', oracle.deploymentTransaction().hash)
    await oracle.waitForDeployment()
    oracleAddr = await oracle.getAddress()
    console.log('Oracle deployed at', oracleAddr)
    const reporter = AGENT_ADDRESS && AGENT_ADDRESS !== '' ? AGENT_ADDRESS : wallet.address
    await (await oracle.setReporterAuthorization(reporter, true, { gasLimit: 250000 })).wait()
    console.log('Oracle reporter authorized:', reporter)
  } else {
    console.log('Using existing Oracle:', oracleAddr)
  }

  await (await factory.setDefaultOracle(oracleAddr, { gasLimit: 250000 })).wait()
  console.log('Factory configured: defaultOracle ->', oracleAddr)

  const net = await provider.getNetwork()
  const out = {
    chainId: Number(net.chainId),
    rpcUrl: RPC_URL,
    deployer: wallet.address,
    agent: AGENT_ADDRESS || wallet.address,
    factory: FACTORY_ADDRESS,
    token: ethers.ZeroAddress,
    oracle: oracleAddr,
    marketDeployer: MARKET_DEPLOYER_ADDRESS,
    marketsWhitelist: [],
  }
  const outDir = path.join(process.cwd(), 'deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'mainnet.json')
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log('Wrote deployments/mainnet.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})