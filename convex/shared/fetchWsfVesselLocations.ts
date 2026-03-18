import { configManager } from "ws-dottie";
import {
  fetchVesselLocations,
  type VesselLocation,
} from "ws-dottie/wsf-vessels/core";

type ProcessEnvLike = Record<string, string | undefined>;

const getRuntimeEnv = (): ProcessEnvLike | undefined => {
  const runtime = globalThis as {
    process?: { env?: ProcessEnvLike };
  };

  return runtime.process?.env;
};

const getConfiguredWsdotAccessToken = (): string | undefined => {
  const env = getRuntimeEnv();

  const directToken = env?.WSDOT_ACCESS_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }

  const expoPublicToken = env?.EXPO_PUBLIC_WSDOT_ACCESS_TOKEN?.trim();
  if (expoPublicToken) {
    return expoPublicToken;
  }

  return undefined;
};

const ensureWsdotAccessToken = (): void => {
  const token = getConfiguredWsdotAccessToken();
  if (!token) {
    throw new Error(
      "Missing WSDOT access token. Expected WSDOT_ACCESS_TOKEN or EXPO_PUBLIC_WSDOT_ACCESS_TOKEN."
    );
  }

  configManager.setApiKey(token);
};

export const fetchWsfVesselLocations = async (): Promise<VesselLocation[]> => {
  ensureWsdotAccessToken();

  // ws-dottie 1.6.0 only injects apiaccesscode when params is present.
  return await fetchVesselLocations({ params: {} });
};
