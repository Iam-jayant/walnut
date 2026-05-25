/**
 * Debug logging utility for Walnut Protocol
 * Logs are only output in development mode
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Log a debug message (only in development)
 */
export function debugLog(message: string, data?: unknown): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.log(`[Walnut Debug] ${message}`, data);
    } else {
      console.log(`[Walnut Debug] ${message}`);
    }
  }
}

/**
 * Log a warning message (only in development)
 */
export function debugWarn(message: string, data?: unknown): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.warn(`[Walnut Warning] ${message}`, data);
    } else {
      console.warn(`[Walnut Warning] ${message}`);
    }
  }
}

/**
 * Log an error message (always logged, even in production)
 */
export function debugError(message: string, error?: unknown): void {
  if (error !== undefined) {
    console.error(`[Walnut Error] ${message}`, error);
  } else {
    console.error(`[Walnut Error] ${message}`);
  }
}

/**
 * Log permit-related debug information (only in development)
 */
export function debugPermit(message: string, data?: unknown): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.log(`[Permit Debug] ${message}`, data);
    } else {
      console.log(`[Permit Debug] ${message}`);
    }
  }
}

/**
 * Log transaction-related debug information (only in development)
 */
export function debugTx(message: string, data?: unknown): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.log(`[Tx Debug] ${message}`, data);
    } else {
      console.log(`[Tx Debug] ${message}`);
    }
  }
}

/**
 * Log decryption-related debug information (only in development)
 */
export function debugDecrypt(message: string, data?: unknown): void {
  if (isDevelopment) {
    if (data !== undefined) {
      console.log(`[Decrypt Debug] ${message}`, data);
    } else {
      console.log(`[Decrypt Debug] ${message}`);
    }
  }
}
