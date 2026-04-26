import { createCofheConfig } from "@cofhe/react";
import { arbSepolia } from "@cofhe/sdk/chains";

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
