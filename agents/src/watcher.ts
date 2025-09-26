import * as dotenv from "dotenv";
dotenv.config();
console.log("Watcher booted.");
console.log({
  SEPOLIA_RPC: process.env.SEPOLIA_RPC_URL,
  AMOY_RPC: process.env.AMOY_RPC_URL,
});
