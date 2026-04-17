import { createCofheConfig } from "@cofhe/react";
import { sepolia as cofheSepolia } from "@cofhe/sdk/chains";

export const cofheConfig = createCofheConfig({
  environment: "react",
  supportedChains: [cofheSepolia],
  react: {
    enableShieldUnshield: false,
    autogeneratePermits: true,
    shareablePermits: false,
    position: "bottom-right",
    initialTheme: "dark",
  },
});
