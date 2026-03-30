import type { Abi, Address } from "viem";

export const walnutWave1Abi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "encryptedAmount",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "encryptedAmount",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getEncryptedCollateral",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "utype", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getEncryptedDebt",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "utype", type: "uint8" },
        ],
      },
    ],
  },
] as const satisfies Abi;

const chainIdFromEnv = Number(process.env.NEXT_PUBLIC_WALNUT_CHAIN_ID ?? "31337");

export const walnutChainId = Number.isFinite(chainIdFromEnv)
  ? chainIdFromEnv
  : 31337;

export const walnutRpcUrl =
  process.env.NEXT_PUBLIC_WALNUT_RPC_URL ?? "http://127.0.0.1:8545";

export const walnutContractAddress =
  (process.env.NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS as Address | undefined) ??
  undefined;
