import { createCofheConfig } from "@cofhe/react";
import { arbSepolia } from "@cofhe/sdk/chains";

// CoFHE configuration for Arbitrum Sepolia
// Arbitrum Sepolia is fully supported by CoFHE (API v1, plugin name: arb-sepolia)
export const cofheConfig = createCofheConfig({
  environment: "react",
  supportedChains: [arbSepolia],
  react: {
    enableShieldUnshield: false,
    autogeneratePermits: true,
    shareablePermits: false,
    position: "bottom-right",
    initialTheme: "dark",
  },
});
