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

export const walnutWave2Abi = [
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
    name: "repay",
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
    name: "withdraw",
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
    name: "getHealthFactor",
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
    name: "requestLiquidationCheck",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "submitLiquidationCheck",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ctHash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidatable",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
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
  {
    type: "function",
    name: "LIQUIDATION_THRESHOLD",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "LTV_LIMIT",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "DepositSubmitted",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "BorrowSubmitted",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "RepaySubmitted",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "WithdrawSubmitted",
    inputs: [{ name: "user", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "LiquidationCheckRequested",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "LiquidationTriggered",
    inputs: [
      { name: "user", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "RepaymentSettlementIntent",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

const chainIdFromEnv = Number(process.env.NEXT_PUBLIC_WALNUT_CHAIN_ID ?? "11155111");

export const walnutChainId = Number.isFinite(chainIdFromEnv)
  ? chainIdFromEnv
  : 11155111;

export const walnutRpcUrl =
  process.env.NEXT_PUBLIC_WALNUT_RPC_URL ?? "http://127.0.0.1:8545";

export const walnutContractAddress =
  (process.env.NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS as Address | undefined) ??
  undefined;

export const walnutWave2ContractAddress =
  (process.env.NEXT_PUBLIC_WALNUT_WAVE2_CONTRACT_ADDRESS as Address | undefined) ??
  undefined;
