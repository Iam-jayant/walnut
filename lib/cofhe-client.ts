import { createCofheConfig } from "@cofhe/react";
import { hardhat as cofheHardhat, sepolia as cofheSepolia } from "@cofhe/sdk/chains";

export const cofheConfig = createCofheConfig({
  environment: "react",
  supportedChains: [cofheHardhat, cofheSepolia],
  react: {
    enableShieldUnshield: false,
    autogeneratePermits: true,
    shareablePermits: false,
    position: "bottom-right",
    initialTheme: "dark",
  },
});
