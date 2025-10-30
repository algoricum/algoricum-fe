// _shared/logger.ts

// Safe JSON.stringify that handles circular references
function safeStringify(obj: any, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }
      return value;
    },
    space,
  );
}

// Enhanced logging function
export function logInfo(message: string, data?: any, prefix?: string) {
  const timestamp = new Date().toISOString();
  const logPrefix = prefix ? `[${timestamp}] ${prefix}: ${message}` : `[${timestamp}] ${message}`;
  try {
    console.log(logPrefix, data ? safeStringify(data, 2) : "");
  } catch {
    console.log(logPrefix, "[Unable to stringify data]", data);
  }
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
