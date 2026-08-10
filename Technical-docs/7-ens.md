# ENS Identity & Multi-Wallet Collateral — Technical Documentation

## Overview

The ENS Identity & Multi-Wallet Collateral functionality allows users to aggregate collateral holdings across multiple secondary Ethereum addresses (or ENS names) into a single primary borrowing identity. On traditional lending platforms, consolidating collateral requires physically sending tokens between wallets in public, traceable on-chain transactions that destroy wallet anonymity and link identities forever.

Walnut solves this by using cryptographic EIP-712 wallet linking (`linkWallet`) and on-chain homomorphic collateral aggregation (`_getAggregatedCollateral`). Users can boost their overall borrowing capacity while keeping individual wallet balances private and unlinked to external surveillance tools.

---

## How It Works Under the Hood

### 1. Cryptographic Wallet Linking (`linkWallet`)
To link a secondary wallet (e.g. `secondary.eth`) to a primary borrowing wallet (`primary.eth`):

1. The secondary wallet signs an EIP-712 typed structured message:
   ```solidity
   bytes32 public constant LINK_WALLET_TYPEHASH = keccak256(
       "LinkWallet(address primary,address secondary,uint256 nonce,string consentMessage)"
   );
   ```
2. The primary wallet submits `linkWallet(address secondary, bytes calldata signature)` to `WalnutLendingV2.sol`.
3. The smart contract verifies the cryptographic signature:

```solidity
function linkWallet(address secondary, bytes calldata signature) external whenNotPaused {
    require(secondary != msg.sender, "Cannot link to self");
    require(primaryWalletOf[secondary] == address(0), "Already linked");
    require(primaryWalletOf[msg.sender] == address(0), "Primary is already a secondary");

    uint256 nonce = nonces[secondary]++;
    bytes32 structHash = keccak256(abi.encode(
        LINK_WALLET_TYPEHASH, 
        msg.sender, 
        secondary, 
        nonce,
        keccak256(bytes("I authorize aggregation and acknowledge that all liquidation surplus accrues exclusively to the primary wallet."))
    ));
    bytes32 hash = _hashTypedDataV4(structHash);
    
    address signer = ECDSA.recover(hash, signature);
    require(signer == secondary, "Invalid signature");

    primaryWalletOf[secondary] = msg.sender;
    linkedWallets[msg.sender].push(secondary);

    // Grant primary wallet access to secondary's FHE collateral & debt
    if (euint128.unwrap(_collateral[secondary]) != 0) {
        FHE.allow(_collateral[secondary], msg.sender);
    }
    if (euint128.unwrap(_debt[secondary]) != 0) {
        FHE.allow(_debt[secondary], msg.sender);
    }

    emit WalletLinked(msg.sender, secondary);
}
```

### 2. On-Chain Homomorphic Aggregation
Once linked, the protocol automatically aggregates collateral and debt ciphertexts across all linked wallets when computing total borrowing power or checking position health:

```solidity
function _getAggregatedCollateral(address primary) internal returns (euint128) {
    euint128 total = _safeEncrypted(_collateral[primary]);
    address[] storage linked = linkedWallets[primary];
    for (uint256 i = 0; i < linked.length; i++) {
        total = FHE.add(total, _safeEncrypted(_collateral[linked[i]]));
    }
    FHE.allowThis(total);
    return total;
}
```

- Homomorphic addition `FHE.add` sums collateral ciphertexts across all linked wallets on-chain inside the FHE runtime.
- Individual wallet balances remain stored separately in `_collateral[secondary]`, preserving privacy.

### 3. Solvency-Protected Unlinking (`requestUnlink` + `syncUnlink`)
Unlinking a secondary wallet removes its collateral from the primary wallet's borrowing base. If the primary wallet has active loans, unlinking could cause undercollateralization or trigger immediate liquidation.

To prevent this exploit, Walnut enforces an asynchronous health factor check before permitting an unlink:

1. **Unlink Request:** Primary wallet calls `requestUnlink(secondaryWallet)`.
2. **Ciphertext Solvency Check:** The contract computes hypothetical health factor excluding the target secondary wallet:
   ```solidity
   euint128 debtScaled = FHE.mul(totalDebt, 10000);
   euint128 collateralScaled = FHE.mul(totalCollateral, LIQUIDATION_THRESHOLD);
   ebool isHealthy = FHE.lte(debtScaled, collateralScaled);
   ```
3. **CoFHE Decrypt Callback:** `syncUnlink` receives the CoFHE threshold result.
4. **Conditional Unlink:** The contract executes `primaryWalletOf[secondary] = address(0)` **only if `result == 1` (healthy)**. If removing the secondary wallet would cause undercollateralization, the unlink transaction reverts!

---

## Technical Highlights & Under-the-Hood Points

- **Signature Spoofing Immunity:** `ECDSA.recover` ensures secondary wallets can only be linked if the owner explicitly signs an EIP-712 message containing a unique per-wallet incrementing `nonce`.
- **Decryption Rights Propagation:** `FHE.allow(_collateral[secondary], msg.sender)` grants the primary wallet owner permission to view aggregated balances using their Access Key permit.
- **Liquidation Surplus Allocation:** In the event of a liquidation, any remaining collateral surplus accrues exclusively to the primary wallet address.

---

## Smart Contract Contribution

| Contract / Feature | Function / Primitive | Technical Contribution |
|--------------------|----------------------|------------------------|
| `WalnutLendingV2.sol` | `linkWallet()` | Validates secondary EIP-712 signature, stores mapping relationship, and propagates FHE decryption permissions. |
| `WalnutLendingV2.sol` | `_getAggregatedCollateral()`, `_getAggregatedDebt()` | Sums encrypted balances across primary and secondary addresses using `FHE.add()`. |
| `WalnutLendingV2.sol` | `requestUnlink()`, `syncUnlink()` | Evaluates hypothetical position solvency in FHE before unlinking secondary wallets. |
| `OpenZeppelin ECDSA` | `ECDSA.recover()`, `_hashTypedDataV4()` | Cryptographically verifies off-chain EIP-712 wallet signatures. |
