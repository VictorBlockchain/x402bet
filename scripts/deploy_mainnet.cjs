// CommonJS deployment script for Hardhat (works reliably with ethers plugin)
const fs = require('fs')
const path = require('path')
const { ethers, network } = require('hardhat')

async function main() {
  const [deployer, , agent] = await ethers.getSigners()
  const provider = ethers.provider

  console.log('ChainId:', (await provider.getNetwork()).chainId)
  console.log('Deployer:', deployer.address)
  console.log('Agent (#2):', agent.address)

  // Mainnet deployment should not include a test token; use address(0)
  const tokenAddr = ethers.ZeroAddress
  console.log('Token set to address(0) for mainnet')

  // Deploy Factory
  const FactoryFactory = await ethers.getContractFactory('X402BetFactory', deployer)
  const feeBps = 250
  const factory = await FactoryFactory.deploy(feeBps, deployer.address, tokenAddr, { gasLimit: 6000000 })
  await factory.waitForDeployment()
  const factoryAddr = await factory.getAddress()
  console.log('Factory deployed at', factoryAddr)

  // Deploy MarketDeployer and wire it into Factory
  const MarketDeployerFactory = await ethers.getContractFactory('MarketDeployer', deployer)
  const marketDeployer = await MarketDeployerFactory.deploy(factoryAddr, { gasLimit: 6000000 })
  await marketDeployer.waitForDeployment()
  const marketDeployerAddr = await marketDeployer.getAddress()
  console.log('MarketDeployer deployed at', marketDeployerAddr)
  await (await factory.setMarketDeployer(marketDeployerAddr, { gasLimit: 200000 })).wait()
  console.log('Factory configured: marketDeployer -> MarketDeployer contract')

  // Configure Oracle: use env ORACLE_ADDRESS if provided, else deploy
  const envOracle = process.env.ORACLE_ADDRESS && process.env.ORACLE_ADDRESS !== '' ? process.env.ORACLE_ADDRESS : null
  let oracleAddr = envOracle
  if (!envOracle || envOracle === ethers.ZeroAddress) {
    const OracleFactory = await ethers.getContractFactory('Oracle', deployer)
    const oracle = await OracleFactory.deploy(factoryAddr, { gasLimit: 6000000 })
    await oracle.waitForDeployment()
    oracleAddr = await oracle.getAddress()
    console.log('Oracle deployed at', oracleAddr)
    // Authorize agent as reporter when we control the oracle
    await (await oracle.setReporterAuthorization(agent.address, true, { gasLimit: 200000 })).wait()
    console.log('Oracle configured: agent authorized as reporter')
  } else {
    console.log('Using existing Oracle from env:', oracleAddr)
  }

  // Configure Factory default oracle
  await (await factory.setDefaultOracle(oracleAddr, { gasLimit: 200000 })).wait()
  console.log('Factory configured: defaultOracle ->', oracleAddr)

  // Resolve RPC URL
  const rpcUrl = network.config.url || 'https://evm-rpc.sei-apis.com'

  // Write deployments/mainnet.json
  const outDir = path.join(process.cwd(), 'deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'mainnet.json')
  const net = await provider.getNetwork()
  const out = {
    chainId: net.chainId,
    rpcUrl,
    deployer: deployer.address,
    agent: agent.address,
    factory: factoryAddr,
    token: tokenAddr,
    oracle: oracleAddr,
    marketDeployer: marketDeployerAddr,
    marketsWhitelist: [],
  }
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n', { encoding: 'utf8' })
  console.log('Wrote deployments/mainnet.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})