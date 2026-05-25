/**
 * Human-readable error message mappings for Walnut Protocol
 * Maps contract revert strings to user-friendly messages
 */

export const ERROR_MESSAGES: Record<string, string> = {
  // WalnutLending errors
  "WalnutLending: repay loan before withdrawing": "Repay your loan first",
  "WalnutLending: zero amount": "Amount must be greater than zero",
  "WalnutLending: no active loan": "You have no active loan to repay",
  "WalnutLending: active loan exists": "You already have an active loan. Repay it before borrowing again",
  "WalnutLending: borrow sync pending": "Your previous transaction is still processing. Please wait",
  "WalnutLending: insufficient vault balance": "Insufficient collateral balance",
  "WalnutLending: protocol paused": "The protocol is temporarily paused",
  "WalnutLending: not owner": "Only the contract owner can perform this action",
  "WalnutLending: not CoFHE": "Invalid callback source",
  "WalnutLending: zero stablecoin": "Invalid stablecoin address",
  "WalnutLending: zero oracle": "Invalid oracle address",
  "WalnutLending: zero treasury": "Invalid treasury address",
  "WalnutLending: zero address": "Invalid address provided",
  "WalnutLending: zero USD value": "Collateral has no USD value",
  "WalnutLending: principal unavailable": "Loan principal data is not yet available",
  "WalnutLending: no guard set": "No position guard has been set",
  "WalnutLending: zero auditor": "Invalid auditor address",
  "WalnutLending: expiry in past": "Expiry time must be in the future",

  // Common wallet errors
  "User rejected the request": "Transaction cancelled",
  "user rejected transaction": "Transaction cancelled",
  "User denied transaction signature": "Transaction cancelled",
  "insufficient funds": "Insufficient funds in your wallet",
  "gas required exceeds allowance": "Gas limit too low. Try increasing gas",
  "nonce too low": "Transaction nonce error. Please try again",
  "replacement transaction underpriced": "Transaction fee too low. Increase gas price",
  "already known": "Transaction already submitted",
  "transaction underpriced": "Gas price too low. Increase gas price",

  // Network errors
  "network changed": "Network changed. Please refresh the page",
  "underlying network changed": "Network changed. Please refresh the page",
  "missing provider": "Wallet not connected. Please connect your wallet",
  "missing signer": "Wallet not connected. Please connect your wallet",

  // Contract interaction errors
  "execution reverted": "Transaction failed. Please try again",
  "call revert exception": "Transaction failed. Please check your inputs",
  "transaction failed": "Transaction failed. Please try again",

  // Permit errors
  "permit expired": "Your permit has expired. Please create a new one",
  "invalid permit": "Invalid permit. Please create a new one",
  "permit not ready": "Permit is still initializing. Please wait",

  // Oracle errors
  "stale price": "Price data is stale. Please try again",
  "invalid price": "Invalid price data",

  // Generic fallbacks
  "unknown error": "An unexpected error occurred. Please try again",
  "timeout": "Request timed out. Please try again",
};

/**
 * Get a human-readable error message from an error object
 * @param error - The error object from a transaction or contract call
 * @returns A user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return "An unexpected error occurred";
  }

  // Handle string errors
  if (typeof error === "string") {
    return humanizeError(error);
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message;

    // Check for revert reasons in the error message
    const revertMatch = message.match(/reason="([^"]+)"/);
    if (revertMatch) {
      return humanizeError(revertMatch[1]);
    }

    // Check for execution reverted with reason
    const executionRevertMatch = message.match(/execution reverted: (.+?)(?:\n|$)/);
    if (executionRevertMatch) {
      return humanizeError(executionRevertMatch[1]);
    }

    return humanizeError(message);
  }

  // Handle objects with message property
  if (typeof error === "object" && error !== null && "message" in error) {
    return humanizeError(String((error as { message: unknown }).message));
  }

  return "An unexpected error occurred";
}

/**
 * Convert a technical error message to a human-readable one
 * @param technicalMessage - The technical error message
 * @returns A user-friendly error message
 */
function humanizeError(technicalMessage: string): string {
  // Direct match
  if (ERROR_MESSAGES[technicalMessage]) {
    return ERROR_MESSAGES[technicalMessage];
  }

  // Partial match (case-insensitive)
  const lowerMessage = technicalMessage.toLowerCase();
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Clean up technical jargon
  let cleaned = technicalMessage
    .replace(/^Error: /, "")
    .replace(/^execution reverted: /, "")
    .replace(/^VM Exception while processing transaction: revert /, "")
    .replace(/\(.*?\)/g, "") // Remove parenthetical content
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // If still too technical or empty, use generic message
  if (!cleaned || cleaned.length < 3 || cleaned.includes("0x")) {
    return "Transaction failed. Please try again";
  }

  return cleaned;
}

/**
 * Check if an error indicates a user cancellation
 * @param error - The error object
 * @returns True if the error was a user cancellation
 */
export function isUserCancellation(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("cancelled") ||
    message.includes("rejected") ||
    message.includes("denied")
  );
}

/**
 * Check if an error is related to insufficient funds
 * @param error - The error object
 * @returns True if the error is about insufficient funds
 */
export function isInsufficientFunds(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("insufficient");
}

/**
 * Check if an error is related to network issues
 * @param error - The error object
 * @returns True if the error is network-related
 */
export function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  );
}
