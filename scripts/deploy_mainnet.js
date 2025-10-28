// ESM deployment script using ethers v6 directly (no Hardhat runtime needed)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ethers } from 'ethers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function reqEnv(name, optional = false) {
  const v = process.env[name]
  if (!v || v.trim() === '') {
    if (optional) return null
    throw new Error(`Missing required env: ${name}`)
  }
  return v.trim()
}

function loadArtifact(relPath) {
  const p = path.join(process.cwd(), 'artifacts', 'evm', 'contracts', relPath)
  const raw = fs.readFileSync(p, 'utf8')
  return JSON.parse(raw)
}

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return
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

async function main() {
  // Load from .env.local if present (does not overwrite existing env)
  loadEnvLocal()
  const RPC_URL = process.env.MAINNET_RPC_URL || 'https://evm-rpc.sei-apis.com'
  const PRIVATE_KEY = reqEnv('MAINNET_PRIVATE_KEY')
  const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || null
  const AGENT_ADDRESS = process.env.AGENT_ADDRESS || null

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  console.log('RPC:', RPC_URL)
  console.log('Deployer:', wallet.address)

  // Load artifacts
  const factoryArt = loadArtifact(path.join('Factory.sol', 'X402BetFactory.json'))
  const marketDepArt = loadArtifact(path.join('MarketDeployer.sol', 'MarketDeployer.json'))
  const oracleArt = loadArtifact(path.join('Oracle.sol', 'Oracle.json'))

  // Deploy Factory (token = address(0))
  const Factory = new ethers.ContractFactory(factoryArt.abi, factoryArt.bytecode, wallet)
  const feeBps = 250
  const factory = await Factory.deploy(feeBps, wallet.address, ethers.ZeroAddress)
  console.log('Factory tx:', factory.deploymentTransaction().hash)
  await factory.waitForDeployment()
  const factoryAddr = await factory.getAddress()
  console.log('Factory deployed at', factoryAddr)

  // Deploy MarketDeployer and set on factory
  const MarketDeployer = new ethers.ContractFactory(marketDepArt.abi, marketDepArt.bytecode, wallet)
  const marketDeployer = await MarketDeployer.deploy(factoryAddr)
  console.log('MarketDeployer tx:', marketDeployer.deploymentTransaction().hash)
  await marketDeployer.waitForDeployment()
  const marketDeployerAddr = await marketDeployer.getAddress()
  console.log('MarketDeployer deployed at', marketDeployerAddr)
  await (await factory.setMarketDeployer(marketDeployerAddr)).wait()
  console.log('Factory configured: marketDeployer set')

  // Oracle: use existing or deploy
  let oracleAddr = ORACLE_ADDRESS
  if (!oracleAddr || oracleAddr === ethers.ZeroAddress) {
    const Oracle = new ethers.ContractFactory(oracleArt.abi, oracleArt.bytecode, wallet)
    const oracle = await Oracle.deploy(factoryAddr)
    console.log('Oracle tx:', oracle.deploymentTransaction().hash)
    await oracle.waitForDeployment()
    oracleAddr = await oracle.getAddress()
    console.log('Oracle deployed at', oracleAddr)
    if (AGENT_ADDRESS && AGENT_ADDRESS !== '') {
      await (await oracle.setReporterAuthorization(AGENT_ADDRESS, true)).wait()
      console.log('Oracle reporter authorized:', AGENT_ADDRESS)
    } else {
      await (await oracle.setReporterAuthorization(wallet.address, true)).wait()
      console.log('Oracle reporter authorized:', wallet.address)
    }
  } else {
    console.log('Using existing Oracle:', oracleAddr)
  }

  // Set default oracle on factory
  await (await factory.setDefaultOracle(oracleAddr)).wait()
  console.log('Factory configured: defaultOracle set')

  const net = await provider.getNetwork()
  const out = {
    chainId: Number(net.chainId),
    rpcUrl: RPC_URL,
    deployer: wallet.address,
    agent: AGENT_ADDRESS || wallet.address,
    factory: factoryAddr,
    token: ethers.ZeroAddress,
    oracle: oracleAddr,
    marketDeployer: marketDeployerAddr,
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