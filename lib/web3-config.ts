import { createConfig, http, injected } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";

import { walnutRpcUrl } from "@/lib/walnut-contract";

export const wagmiConfig = createConfig({
  chains: [hardhat, sepolia],
  connectors: [injected()],
  transports: {
    [hardhat.id]: http(walnutRpcUrl),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
});
