// Deploy local contracts and write .env.local for the Next app
import fs from 'node:fs'
import path from 'node:path'
import { ethers } from 'ethers'

async function main() {
  // Compilation is handled by Hardhat runner

  // Allow overriding RPC via environment; default to local Hardhat node
  const rpcUrl = process.env.EVM_RPC_URL || 'http://127.0.0.1:8546'
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  // Use Hardhat node default accounts: #0 deployer, #2 agent
  const deployerPk = '0x2d92b888c8a469694406ea81920c9aa57e48554a5745bffda2f415c0c0f333a5'
  const agentPk = '0x2d92b888c8a469694406ea81920c9aa57e48554a5745bffda2f415c0c0f333a5'
  const deployer = new ethers.Wallet(deployerPk, provider)
  const agent = new ethers.Wallet(agentPk, provider)
  const chainId = await provider.getNetwork().then((n) => Number(n.chainId))

  console.log('ChainId:', chainId)
  console.log('Deployer:', deployer.address)
  console.log('Agent (#2):', agent.address)

  // Load artifacts
  const artifactsBase = path.join(process.cwd(), 'artifacts', 'evm', 'contracts')
  const loadArtifact = (relPath, contractName) => {
    const p = path.join(artifactsBase, relPath, `${contractName}.json`)
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  }

  const testTokenArtifact = loadArtifact('TestToken.sol', 'TestToken')
  const factoryArtifact = loadArtifact('Factory.sol', 'X402BetFactory')
  const oracleArtifact = loadArtifact('Oracle.sol', 'Oracle')
  const marketDeployerArtifact = loadArtifact('MarketDeployer.sol', 'MarketDeployer')

  // Deploy TestToken (mint to agent)
  const TestTokenFactory = new ethers.ContractFactory(
    testTokenArtifact.abi,
    testTokenArtifact.bytecode,
    deployer,
  )
  let token
  try {
    token = await TestTokenFactory.deploy(
      'X402Bet',
      'X402',
      18,
      ethers.parseEther('1000000'),
      agent.address,
      { gasLimit: 6000000 },
    )
    await token.waitForDeployment()
    console.log('TestToken deployed at', await token.getAddress())
  } catch (e) {
    console.error('ERROR: TestToken deploy failed:', e)
    throw e
  }

  await new Promise((resolve) => setTimeout(resolve, 100))
  // Refresh nonce after mining
  let nextNonce = await provider.getTransactionCount(deployer.address, 'latest')

  // Deploy Factory
  const FactoryFactory = new ethers.ContractFactory(
    factoryArtifact.abi,
    factoryArtifact.bytecode,
    deployer,
  )
  const feeBps = 250; // 2.5% fee
  let factory
  try {
    factory = await FactoryFactory.deploy(
      feeBps,
      deployer.address,
      await token.getAddress(),
      { gasLimit: 6000000, nonce: nextNonce++ },
    )
    await factory.waitForDeployment()
    console.log('Factory deployed at', await factory.getAddress())
  } catch (e) {
    console.error('ERROR: Factory deploy failed:', e)
    throw e
  }

  await new Promise((resolve) => setTimeout(resolve, 100))

  // Deploy MarketDeployer and wire it into Factory
  const MarketDeployerFactory = new ethers.ContractFactory(
    marketDeployerArtifact.abi,
    marketDeployerArtifact.bytecode,
    deployer,
  )
  let marketDeployer
  try {
    marketDeployer = await MarketDeployerFactory.deploy(
      await factory.getAddress(),
      { gasLimit: 6000000, nonce: nextNonce++ },
    )
    await marketDeployer.waitForDeployment()
    console.log('MarketDeployer deployed at', await marketDeployer.getAddress())
  } catch (e) {
    console.error('ERROR: MarketDeployer deploy failed:', e)
    throw e
  }

  await new Promise((resolve) => setTimeout(resolve, 100))
  try {
    await factory.setMarketDeployer(await marketDeployer.getAddress(), { gasLimit: 200000, nonce: nextNonce++ })
    console.log('Factory configured: marketDeployer -> MarketDeployer contract')
  } catch (e) {
    console.error('ERROR: setMarketDeployer failed:', e)
    throw e
  }

  // Deploy Oracle
  const OracleFactory = new ethers.ContractFactory(
    oracleArtifact.abi,
    oracleArtifact.bytecode,
    deployer,
  )
  let oracle
  try {
    oracle = await OracleFactory.deploy(
      await factory.getAddress(),
      { gasLimit: 6000000, nonce: nextNonce++ },
    )
    await oracle.waitForDeployment()
    console.log('Oracle deployed at', await oracle.getAddress())
  } catch (e) {
    console.error('ERROR: Oracle deploy failed:', e)
    throw e
  }

  await new Promise((resolve) => setTimeout(resolve, 100))

  // Configure Factory: set default oracle to the Oracle contract
  try {
    await factory.setDefaultOracle(await oracle.getAddress(), { gasLimit: 200000, nonce: nextNonce++ })
    console.log('Factory configured: defaultOracle -> Oracle contract')
  } catch (e) {
    console.error('ERROR: setDefaultOracle failed:', e)
    throw e
  }

  // Authorize agent as oracle reporter
  try {
    await oracle.setReporterAuthorization(agent.address, true, { gasLimit: 200000, nonce: nextNonce++ })
    console.log('Oracle configured: agent authorized as reporter')
  } catch (e) {
    console.error('ERROR: setReporterAuthorization failed:', e)
    throw e
  }

  // Skip writing .env.local to avoid overwriting existing environment variables

  // Also write deployments/local.json
  const outDir = path.join(process.cwd(), 'deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'local.json')
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        chainId,
        rpcUrl: rpcUrl.replace('127.0.0.1', 'localhost'),
        deployer: deployer.address,
        agent: agent.address,
        factory: await factory.getAddress(),
        token: await token.getAddress(),
        oracle: await oracle.getAddress(),
        marketDeployer: await marketDeployer.getAddress(),
      },
      null,
      2,
    ) + '\n',
    { encoding: 'utf8' },
  )
  console.log('Wrote deployments/local.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})