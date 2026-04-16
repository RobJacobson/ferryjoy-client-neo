/**
 * WSF vessel-location boundary adapter.
 *
 * Fetches raw vessel locations from the WSDOT-backed WSF API and centralizes
 * runtime token setup for all backend consumers.
 */

import type { VesselLocation } from "ws-dottie/wsf-vessels/core";

type ProcessEnvLike = Record<string, string | undefined>;

/**
 * Reads the current runtime environment if one exists.
 *
 * @returns Process environment-like object when available
 */
const getRuntimeEnv = (): ProcessEnvLike | undefined => {
  const runtime = globalThis as {
    process?: { env?: ProcessEnvLike };
  };

  return runtime.process?.env;
};

/**
 * Resolves the configured WSDOT access token from supported environment names.
 *
 * @returns Trimmed access token or `undefined` when none is configured
 */
const getConfiguredWsdotAccessToken = (): string | undefined => {
  const env = getRuntimeEnv();
  return (
    env?.WSDOT_ACCESS_TOKEN?.trim() ||
    env?.EXPO_PUBLIC_WSDOT_ACCESS_TOKEN?.trim()
  );
};

/**
 * Validates and applies the WSDOT access token for ws-dottie.
 *
 * @param configManager - ws-dottie config manager runtime
 */
const ensureWsdotAccessToken = (configManager: {
  setApiKey: (token: string) => void;
}): void => {
  const token = getConfiguredWsdotAccessToken();
  if (!token) {
    throw new Error(
      "Missing WSDOT access token. Expected WSDOT_ACCESS_TOKEN or EXPO_PUBLIC_WSDOT_ACCESS_TOKEN."
    );
  }

  configManager.setApiKey(token);
};

/**
 * Fetches the latest raw WSF vessel locations.
 *
 * @returns Raw WSF vessel-location payloads from `ws-dottie`
 */
export const fetchWsfVesselLocations = async (): Promise<VesselLocation[]> => {
  const [{ configManager }, { fetchVesselLocations }] = await Promise.all([
    import("ws-dottie"),
    import("ws-dottie/wsf-vessels/core"),
  ]);

  ensureWsdotAccessToken(configManager);

  // ws-dottie 1.6.0 only injects apiaccesscode when params is present.
  return await fetchVesselLocations({ params: {} });
};
