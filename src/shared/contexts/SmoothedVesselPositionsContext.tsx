import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { VesselLocation } from "@/domain/vessels/vesselLocation";
import {
  animateVesselsSafe,
  checkForTeleportation,
  getNewVessels,
  SMOOTHING_INTERVAL_MS,
  TELEPORTATION_CHECK_INTERVAL_MS,
  type VesselWithProjection,
} from "@/shared/utils/calculateVesselPositions";
import { useConvexVesselLocations } from "./ConvexVesselLocationsContext";

type SmoothedVesselPositionsContextValue = {
  smoothedVessels: VesselLocation[];
};

const SmoothedVesselPositionsContext =
  createContext<SmoothedVesselPositionsContextValue | null>(null);

export const useSmoothedVesselPositions = () => {
  const context = useContext(SmoothedVesselPositionsContext);
  if (!context) {
    throw new Error(
      "useSmoothedVesselPositions must be used within a SmoothedVesselPositionsProvider"
    );
  }
  return context;
};

export const SmoothedVesselPositionsProvider = ({
  children,
}: PropsWithChildren) => {
  const [smoothedVessels, setSmoothedVessels] = useState<
    VesselWithProjection[]
  >([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  );
  const teleportationCheckIntervalRef = useRef<
    ReturnType<typeof setInterval> | undefined
  >(undefined);

  // Get real-time vessel location data from ConvexContext
  const { vesselLocations } = useConvexVesselLocations();
  const currentVessels = vesselLocations || [];

  // Add new vessels to the animation system with projections
  // biome-ignore lint/correctness/useExhaustiveDependencies: only depends on currentVessels
  useEffect(() => {
    const newVesselLocations = getNewVessels(smoothedVessels, currentVessels);
    if (newVesselLocations.length > 0) {
      setSmoothedVessels((prev) => [...prev, ...newVesselLocations]);
    }
  }, [currentVessels]);

  // Continuous animation loop - updates vessel positions every second
  useEffect(() => {
    // Schedule animation frames
    intervalRef.current = setInterval(() => {
      setSmoothedVessels((prev) => animateVesselsSafe(prev, currentVessels));
    }, SMOOTHING_INTERVAL_MS);

    // Cleanup timer on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [currentVessels]);

  // Teleportation detection loop
  useEffect(() => {
    teleportationCheckIntervalRef.current = setInterval(() => {
      setSmoothedVessels((prev) => checkForTeleportation(prev, currentVessels));
    }, TELEPORTATION_CHECK_INTERVAL_MS);

    return () => {
      if (teleportationCheckIntervalRef.current) {
        clearInterval(teleportationCheckIntervalRef.current);
        teleportationCheckIntervalRef.current = undefined;
      }
    };
  }, [currentVessels]);

  // Transform VesselWithProjection[] to VesselLocation[] for consumers
  const transformedVessels: VesselLocation[] = smoothedVessels.map(
    ({
      ProjectedLatitude,
      ProjectedLongitude,
      ProjectionTimestamp,
      ...vessel
    }) => vessel
  );

  const value = {
    smoothedVessels: transformedVessels,
  };

  return (
    <SmoothedVesselPositionsContext.Provider value={value}>
      {children}
    </SmoothedVesselPositionsContext.Provider>
  );
};
