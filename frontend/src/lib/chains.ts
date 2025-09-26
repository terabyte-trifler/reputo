export const CHAINS = {
  sepolia: { name: "Ethereum Sepolia", rpc: process.env.NEXT_PUBLIC_SEPOLIA_RPC! },
  amoy: { name: "Polygon Amoy", rpc: process.env.NEXT_PUBLIC_AMOY_RPC! },
  alfajores: { name: "Celo Alfajores", rpc: process.env.NEXT_PUBLIC_CELO_ALFA_RPC! }
} as const;

export type ChainKey = keyof typeof CHAINS;
