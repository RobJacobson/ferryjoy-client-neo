/**
 * Retries external WSF schedule API calls once after a fixed delay.
 */

const RETRY_DELAY_MS = 15_000;

/**
 * Runs an async operation and retries once after a delay when it fails.
 *
 * @param fn - External API call to execute
 * @returns Result from the initial call or the single retry attempt
 */
export const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn("API call failed, retrying once:", error);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return await fn();
  }
};
