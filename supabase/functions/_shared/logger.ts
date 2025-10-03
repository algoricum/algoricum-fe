// _shared/logger.ts

// Enhanced logging function
export function logInfo(message: string, data?: any, prefix?: string) {
  const timestamp = new Date().toISOString();
  const logPrefix = prefix ? `[${timestamp}] ${prefix}: ${message}` : `[${timestamp}] ${message}`;
  console.log(logPrefix, data ? JSON.stringify(data, null, 2) : "");
}

export function logError(message: string, error?: any, prefix?: string) {
  const timestamp = new Date().toISOString();
  const logPrefix = prefix ? `[${timestamp}] ${prefix} ERROR: ${message}` : `[${timestamp}] ERROR: ${message}`;
  console.error(logPrefix, error);
}

// Specialized logging functions for different contexts
export const createLogger = (prefix: string) => ({
  info: (message: string, data?: any) => logInfo(message, data, prefix),
  error: (message: string, error?: any) => logError(message, error, prefix),
});
