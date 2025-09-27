// hardhat.config.ts — plugin must be a static top-level import
import "@nomicfoundation/hardhat-ethers";

import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import * as path from "node:path";

// load .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const PRIV_KEY = process.env.PRIVATE_KEY || "";
const ACCOUNTS = PRIV_KEY ? [PRIV_KEY] : [];

// networks only when URLs present
type NetworksMap = Record<string, any>;
const networks: NetworksMap = {
  hardhat: { type: "edr-simulated", chainId: 31337 },
  localhost: { type: "http", url: "http://127.0.0.1:8545", chainId: 31337 },
};

if (process.env.SEPOLIA_RPC_URL && process.env.SEPOLIA_RPC_URL.length > 0) {
  networks.sepolia = {
    type: "http",
    url: process.env.SEPOLIA_RPC_URL,
    chainId: 11155111,
    accounts: ACCOUNTS,
  };
}
if (process.env.AMOY_RPC_URL && process.env.AMOY_RPC_URL.length > 0) {
  networks.polygonAmoy = {
    type: "http",
    url: process.env.AMOY_RPC_URL,
    chainId: 80002,
    accounts: ACCOUNTS,
  };
}
if (process.env.CELO_ALFA_RPC_URL && process.env.CELO_ALFA_RPC_URL.length > 0) {
  networks.celoAlfajores = {
    type: "http",
    url: process.env.CELO_ALFA_RPC_URL,
    chainId: 44787,
    accounts: ACCOUNTS,
  };
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: networks as any,
};

export default config;