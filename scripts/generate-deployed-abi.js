const fs = require('fs');
const path = require('path');

const ARTIFACT_PATH = path.join(__dirname, '../artifacts/contracts/WalnutLending.sol/WalnutLending.json');
const OUTPUT_DIR = path.join(__dirname, '../abis');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'WalnutLending.deployed.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load current artifact
if (!fs.existsSync(ARTIFACT_PATH)) {
  console.error(`Artifact not found at: ${ARTIFACT_PATH}`);
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
const abi = artifact.abi;

// InEuint128 structure
const InEuint128Components = [
  { name: 'ctHash', type: 'uint256', internalType: 'uint256' },
  { name: 'securityZone', type: 'uint8', internalType: 'uint8' },
  { name: 'utype', type: 'uint8', internalType: 'uint8' },
  { name: 'signature', type: 'bytes', internalType: 'bytes' }
];

const InEuint128Type = {
  name: 'encryptedAmount',
  type: 'tuple',
  internalType: 'struct InEuint128',
  components: InEuint128Components
};

// 1. Modify deposit
const depositIdx = abi.findIndex(x => x.name === 'deposit');
if (depositIdx !== -1) {
  abi[depositIdx] = {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      Object.assign({}, InEuint128Type, { name: 'encryptedAmount' })
    ],
    outputs: []
  };
}

// 2. Modify withdraw
const withdrawIdx = abi.findIndex(x => x.name === 'withdraw');
if (withdrawIdx !== -1) {
  abi[withdrawIdx] = {
    name: 'withdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      Object.assign({}, InEuint128Type, { name: 'encryptedAmount' })
    ],
    outputs: []
  };
}

// 3. Modify getLoans (0 arguments, msg.sender-based, returns PublicLoanInfo[])
const getLoansIdx = abi.findIndex(x => x.name === 'getLoans');
if (getLoansIdx !== -1) {
  abi[getLoansIdx] = {
    name: 'getLoans',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct PublicLoanInfo[]',
        components: [
          { name: 'loanId', type: 'uint256', internalType: 'uint256' },
          { name: 'openedAt', type: 'uint256', internalType: 'uint256' },
          { name: 'active', type: 'bool', internalType: 'bool' }
        ]
      }
    ]
  };
}

// 4. Modify getActiveLoans (0 arguments, msg.sender-based, returns PublicLoanInfo[] and uint256[] indices)
const getActiveLoansIdx = abi.findIndex(x => x.name === 'getActiveLoans');
if (getActiveLoansIdx !== -1) {
  abi[getActiveLoansIdx] = {
    name: 'getActiveLoans',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: 'activeLoans',
        type: 'tuple[]',
        internalType: 'struct PublicLoanInfo[]',
        components: [
          { name: 'loanId', type: 'uint256', internalType: 'uint256' },
          { name: 'openedAt', type: 'uint256', internalType: 'uint256' },
          { name: 'active', type: 'bool', internalType: 'bool' }
        ]
      },
      {
        name: 'indices',
        type: 'uint256[]',
        internalType: 'uint256[]'
      }
    ]
  };
}

// 5. Modify getLinkedWallets (0 arguments, returns address[])
const getLinkedWalletsIdx = abi.findIndex(x => x.name === 'getLinkedWallets');
if (getLinkedWalletsIdx !== -1) {
  abi[getLinkedWalletsIdx] = {
    name: 'getLinkedWallets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '', type: 'address[]', internalType: 'address[]' }
    ]
  };
}

// 6. Modify registerLinkedWallet (4 arguments)
const registerLinkedWalletIdx = abi.findIndex(x => x.name === 'registerLinkedWallet');
if (registerLinkedWalletIdx !== -1) {
  abi[registerLinkedWalletIdx] = {
    name: 'registerLinkedWallet',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'additionalWallet', type: 'address', internalType: 'address' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
      { name: 'v', type: 'uint8', internalType: 'uint8' }
    ],
    outputs: []
  };
}

// 7. Add syncDepositTransfer and syncWithdrawTransfer callback functions
if (!abi.some(x => x.name === 'syncDepositTransfer')) {
  abi.push({
    name: 'syncDepositTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'ciphertext', type: 'bytes32', internalType: 'euint128' },
      { name: 'result', type: 'uint128', internalType: 'uint128' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' }
    ],
    outputs: []
  });
}
if (!abi.some(x => x.name === 'syncWithdrawTransfer')) {
  abi.push({
    name: 'syncWithdrawTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'ciphertext', type: 'bytes32', internalType: 'euint128' },
      { name: 'result', type: 'uint128', internalType: 'uint128' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' }
    ],
    outputs: []
  });
}

// 8. Rename syncLoanPrincipal to syncBorrowActive
const syncLoanPrincipalIdx = abi.findIndex(x => x.name === 'syncLoanPrincipal');
if (syncLoanPrincipalIdx !== -1) {
  abi[syncLoanPrincipalIdx].name = 'syncBorrowActive';
} else if (!abi.some(x => x.name === 'syncBorrowActive')) {
  abi.push({
    name: 'syncBorrowActive',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'ciphertext', type: 'bytes32', internalType: 'euint128' },
      { name: 'result', type: 'uint128', internalType: 'uint128' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' }
    ],
    outputs: []
  });
}

// 9. Modify BorrowPrincipalSyncRequested to BorrowActiveSyncRequested
const borrowPrincipalSyncReqIdx = abi.findIndex(x => x.name === 'BorrowPrincipalSyncRequested');
if (borrowPrincipalSyncReqIdx !== -1) {
  abi[borrowPrincipalSyncReqIdx] = {
    name: 'BorrowActiveSyncRequested',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'requestId', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'loanId', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  };
}

// 10. Add DepositSyncRequested and WithdrawSyncRequested events
if (!abi.some(x => x.name === 'DepositSyncRequested')) {
  abi.push({
    name: 'DepositSyncRequested',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'requestId', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  });
}
if (!abi.some(x => x.name === 'WithdrawSyncRequested')) {
  abi.push({
    name: 'WithdrawSyncRequested',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'requestId', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  });
}

// Save to output path
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(abi, null, 2), 'utf8');
console.log(`✅ Deployed ABI successfully written to: ${OUTPUT_PATH}`);
