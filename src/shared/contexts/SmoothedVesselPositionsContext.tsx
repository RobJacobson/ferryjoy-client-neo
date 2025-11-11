import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { VesselLocation } from "ws-dottie/wsf-vessels";
import {
  animateVesselsSafe,
  getNewVessels,
  SMOOTHING_INTERVAL_MS,
} from "@/shared/utils/calculateVesselPositions";
import { useWsDottie } from "./WsDottieContext";

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
  const [smoothedVessels, setSmoothedVessels] = useState<VesselLocation[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined
  );

  // Get real-time vessel location data from WsDottieContext
  const { vesselLocations } = useWsDottie();
  const currentVessels = vesselLocations.data || [];

  // Add new vessels to the animation system
  // biome-ignore lint/correctness/useExhaustiveDependencies: only depends on currentVessels
  useEffect(() => {
    const newVesselLocations = getNewVessels(smoothedVessels, currentVessels);
    if (newVesselLocations.length > 0) {
      setSmoothedVessels(prev => [...prev, ...newVesselLocations]);
    }
  }, [currentVessels]);

  // Continuous animation loop - updates vessel positions every second
  useEffect(() => {
    // Schedule animation frames
    intervalRef.current = setInterval(() => {
      setSmoothedVessels(prev => animateVesselsSafe(prev, currentVessels));
    }, SMOOTHING_INTERVAL_MS);

    // Cleanup timer on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [currentVessels]);

  const value = {
    smoothedVessels,
  };

  return (
    <SmoothedVesselPositionsContext.Provider value={value}>
      {children}
    </SmoothedVesselPositionsContext.Provider>
  );
};
