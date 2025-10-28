// Minimal ESM Hardhat config for compilation with ethers plugin
import '@nomicfoundation/hardhat-ethers';

export default {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: './evm/contracts',
    cache: './.hh-cache',
    artifacts: './artifacts',
  },
  networks: {
    localhost: {
      type: 'http',
      url: 'http://127.0.0.1:8546',
      chainId: 31337,
      accounts: [
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
      ],
    },
    hardhat: {
      type: 'edr-simulated',
      chainId: 31337,
    },
    seiTestnet: {
      type: 'http',
      url: 'https://evm-rpc-testnet.sei-apis.com',
      accounts: ['aa0be0346a4e690e1de7434858baae05e4a95507db6d871c4420a49f597cb9cd'],
      chainId: 1328,
    },
    seiMainnet: {
      type: 'http',
      url: 'https://evm-rpc.sei-apis.com',
      accounts: ['0x728f315a9c0610b535b78fc4ae869c0effb74ab602e33621da73c01511f9137a'],
      chainId: 1329,
    },
  },
  etherscan: {
    apiKey: {
      seiMainnet: 'dummy',
      seiTestnet: 'dummy'
    },
    customChains: [
      {
        network: 'seiMainnet',
        chainId: 1329,
        urls: {
          apiURL: 'https://seitrace.com/pacific-1/api',
          browserURL: 'https://seitrace.com/pacific-1'
        }
      },
      {
        network: 'seiTestnet',
        chainId: 1328,
        urls: {
          apiURL: 'https://seitrace.com/atlantic-2/api',
          browserURL: 'https://seitrace.com/atlantic-2'
        }
      }
    ]
  },
};