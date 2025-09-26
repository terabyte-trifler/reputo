import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "";
const AMOY_RPC = process.env.AMOY_RPC_URL || "";
const CELO_ALFA_RPC = process.env.CELO_ALFA_RPC_URL || "";
const PRIV_KEY = process.env.PRIVATE_KEY || "";

const ACCOUNTS = PRIV_KEY ? [PRIV_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
  networks: {
    sepolia: {
      type: "http",
      url: SEPOLIA_RPC,
      chainId: 11155111,
      accounts: ACCOUNTS,
    },
    polygonAmoy: {
      type: "http",
      url: AMOY_RPC,
      chainId: 80002,
      accounts: ACCOUNTS,
    },
    celoAlfajores: {
      type: "http",
      url: CELO_ALFA_RPC,
      chainId: 44787,
      accounts: ACCOUNTS,
    },
  },
};

export default config;
