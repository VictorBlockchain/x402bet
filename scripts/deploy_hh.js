// Deploy using Hardhat runtime to avoid manual nonce/gas issues
import fs from 'node:fs'
import path from 'node:path'
import { ethers, network } from 'hardhat'

async function main() {
  const [deployer, , agent] = await ethers.getSigners()
  const provider = ethers.provider

  console.log('ChainId:', (await provider.getNetwork()).chainId)
  console.log('Deployer:', deployer.address)
  console.log('Agent (#2):', agent.address)

  // Deploy TestToken
  const TestTokenFactory = await ethers.getContractFactory('TestToken', deployer)
  const token = await TestTokenFactory.deploy('X402Bet', 'X402', 18, ethers.parseEther('1000000'), agent.address, { gasLimit: 6000000 })
  await token.waitForDeployment()
  const tokenAddr = await token.getAddress()
  console.log('TestToken deployed at', tokenAddr)

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

  // Deploy Oracle
  const OracleFactory = await ethers.getContractFactory('Oracle', deployer)
  const oracle = await OracleFactory.deploy(factoryAddr, { gasLimit: 6000000 })
  await oracle.waitForDeployment()
  const oracleAddr = await oracle.getAddress()
  console.log('Oracle deployed at', oracleAddr)

  // Configure Factory
  await (await factory.setDefaultOracle(oracleAddr, { gasLimit: 200000 })).wait()
  console.log('Factory configured: defaultOracle -> Oracle contract')

  // Authorize agent as reporter
  await (await oracle.setReporterAuthorization(agent.address, true, { gasLimit: 200000 })).wait()
  console.log('Oracle configured: agent authorized as reporter')

  // Resolve RPC URL but do not write .env.local to avoid overwriting existing env
  const rpcUrl = network.config.url || 'http://localhost:8546'

  // Write deployments/local.json
  const outDir = path.join(process.cwd(), 'deployments')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, 'local.json')
  fs.writeFileSync(outFile, JSON.stringify({
    chainId: (await provider.getNetwork()).chainId,
    rpcUrl,
    deployer: deployer.address,
    agent: agent.address,
    factory: factoryAddr,
    token: tokenAddr,
    oracle: oracleAddr,
    marketDeployer: marketDeployerAddr,
  }, null, 2) + '\n', { encoding: 'utf8' })
  console.log('Wrote deployments/local.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})