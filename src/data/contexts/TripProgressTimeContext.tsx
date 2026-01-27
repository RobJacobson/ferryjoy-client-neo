/**
 * Context for providing current time to trip progress components.
 * Centralizes time management to avoid prop drilling and multiple timers.
 */

import { createContext, useContext, useState } from "react";
import { useInterval } from "@/shared/hooks";

/**
 * Context type for trip progress time.
 * Undefined means the provider is not being used.
 */
type TripProgressTimeContextType = number | undefined;

const TripProgressTimeContext =
  createContext<TripProgressTimeContextType>(undefined);

/**
 * Provider component that manages and provides current time.
 * Updates time every second and makes it available to all children.
 *
 * @param children - Child components that need access to current time
 * @returns Provider component wrapping children
 */
export const TripProgressTimeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Manage time at provider level to avoid multiple intervals
  const [nowMs, setNowMs] = useState(() => Date.now());
  useInterval(() => setNowMs(Date.now()), 1000);

  return (
    <TripProgressTimeContext.Provider value={nowMs}>
      {children}
    </TripProgressTimeContext.Provider>
  );
};

/**
 * Hook to access current time from TripProgressTimeContext.
 *
 * @throws Error if used outside of TripProgressTimeProvider
 * @returns Current time in milliseconds
 */
export const useTripProgressTime = (): number => {
  const nowMs = useContext(TripProgressTimeContext);
  if (nowMs === undefined) {
    throw new Error(
      "useTripProgressTime must be used within TripProgressTimeProvider"
    );
  }
  return nowMs;
};
