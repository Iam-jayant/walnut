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

export const walnutWave2Abi = [{"inputs":[{"internalType":"uint8","name":"got","type":"uint8"},{"internalType":"uint8","name":"expected","type":"uint8"}],"name":"InvalidEncryptedInput","type":"error"},{"inputs":[{"internalType":"int32","name":"value","type":"int32"}],"name":"SecurityZoneOutOfBounds","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"primaryWallet","type":"address"},{"indexed":false,"internalType":"uint256","name":"ctHash","type":"uint256"}],"name":"AggregatedCollateralHandle","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"borrower","type":"address"},{"indexed":false,"internalType":"uint256","name":"endTime","type":"uint256"}],"name":"AuctionOpened","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"borrower","type":"address"},{"indexed":true,"internalType":"address","name":"winner","type":"address"}],"name":"AuctionSettled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"borrower","type":"address"},{"indexed":true,"internalType":"address","name":"bidder","type":"address"}],"name":"BidSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"BorrowSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"DepositSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"primary","type":"address"},{"indexed":true,"internalType":"address","name":"additional","type":"address"},{"indexed":false,"internalType":"string","name":"ensName","type":"string"}],"name":"ENSWalletAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"ctHash","type":"uint256"}],"name":"HealthFactorHandle","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"requestId","type":"uint256"}],"name":"LiquidationCheckRequested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"LiquidationTriggered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"RepaySubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"RepaymentSettlementIntent","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"borrower","type":"address"}],"name":"SelectionRequested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"WithdrawSubmitted","type":"event"},{"inputs":[],"name":"BID_WINDOW","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"LIQUIDATION_THRESHOLD","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"LTV_LIMIT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"auctions","outputs":[{"internalType":"address","name":"borrower","type":"address"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"bool","name":"settled","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"securityZone","type":"uint8"},{"internalType":"uint8","name":"utype","type":"uint8"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"struct InEuint128","name":"encryptedAmount","type":"tuple"}],"name":"borrow","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"securityZone","type":"uint8"},{"internalType":"uint8","name":"utype","type":"uint8"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"struct InEuint128","name":"encryptedAmount","type":"tuple"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"ensWallets","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"reqId","type":"uint256"}],"name":"finalizeWinnerSelection","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"primaryWallet","type":"address"}],"name":"getAggregatedCollateral","outputs":[{"internalType":"euint128","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"}],"name":"getAuctionBidCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getAuctionBidder","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAuctionBorrowers","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"}],"name":"getAuctionSummary","outputs":[{"internalType":"address","name":"auctionBorrower","type":"address"},{"internalType":"uint256","name":"endTime","type":"uint256"},{"internalType":"uint256","name":"bidCount","type":"uint256"},{"internalType":"bool","name":"settled","type":"bool"},{"internalType":"bool","name":"active","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getEncryptedCollateral","outputs":[{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"utype","type":"uint8"}],"internalType":"struct WalnutWave2b.EncryptedValue","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getEncryptedDebt","outputs":[{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"utype","type":"uint8"}],"internalType":"struct WalnutWave2b.EncryptedValue","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getHealthFactor","outputs":[{"internalType":"euint128","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"primaryWallet","type":"address"}],"name":"getLinkedWalletCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"primaryWallet","type":"address"}],"name":"getLinkedWallets","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"}],"name":"getPendingWinnerRequestId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"liquidatable","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"reqId","type":"uint256"},{"internalType":"uint128","name":"result","type":"uint128"}],"name":"onWinnerSelected","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"}],"name":"openAuction","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"pendingWinnerRequestByBorrower","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"ensName","type":"string"},{"internalType":"address","name":"additionalWallet","type":"address"}],"name":"registerENSWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"securityZone","type":"uint8"},{"internalType":"uint8","name":"utype","type":"uint8"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"struct InEuint128","name":"encryptedAmount","type":"tuple"}],"name":"repay","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"requestLiquidationCheck","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"}],"name":"selectWinningBid","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"borrower","type":"address"},{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"securityZone","type":"uint8"},{"internalType":"uint8","name":"utype","type":"uint8"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"struct InEuint128","name":"encryptedPenalty","type":"tuple"}],"name":"submitBid","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"ctHash","type":"bytes32"}],"name":"submitLiquidationCheck","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"walletToENS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"uint256","name":"ctHash","type":"uint256"},{"internalType":"uint8","name":"securityZone","type":"uint8"},{"internalType":"uint8","name":"utype","type":"uint8"},{"internalType":"bytes","name":"signature","type":"bytes"}],"internalType":"struct InEuint128","name":"encryptedAmount","type":"tuple"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const satisfies Abi;

function requirePublicEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[walnut-contract] Missing required environment variable: ${key}`);
  }

  return value;
}

const chainIdRaw = requirePublicEnv("NEXT_PUBLIC_CHAIN_ID");
const parsedChainId = Number(chainIdRaw);

if (!Number.isInteger(parsedChainId) || parsedChainId <= 0) {
  throw new Error(
    `[walnut-contract] NEXT_PUBLIC_CHAIN_ID must be a positive integer. Received: ${chainIdRaw}`
  );
}

export const walnutChainId = parsedChainId;

export const walnutRpcUrl = requirePublicEnv("NEXT_PUBLIC_RPC_URL_PRIMARY");

export const walnutContractAddress =
  (process.env.NEXT_PUBLIC_WALNUT_CONTRACT_ADDRESS as Address | undefined) ??
  undefined;

export const walnutWave2CoreContractAddress =
  (process.env.NEXT_PUBLIC_WALNUT_WAVE2_CORE_CONTRACT_ADDRESS as Address | undefined) ??
  undefined;

export const walnutWave2bContractAddress =
  (process.env.NEXT_PUBLIC_WALNUT_WAVE2_CONTRACT_ADDRESS as Address | undefined) ??
  undefined;

// Backward-compatible alias used throughout existing app code.
export const walnutWave2ContractAddress = walnutWave2bContractAddress;
