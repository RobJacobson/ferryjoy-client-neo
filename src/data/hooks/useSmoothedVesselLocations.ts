import { distance } from "@turf/turf";
import { useEffect, useRef, useState } from "react";
import type { VesselLocation } from "@/domain";
import { lerp } from "@/shared/utils/lerp";
import {
  PROJECTION_TIME_MS,
  projectVesselLocation,
} from "@/shared/utils/projectVesselLocation";

const SMOOTHING_INTERVAL_MS = 1000;
const TELEPORT_THRESHOLD_KM = 0.5;

type ObservationState = {
  vessel: VesselLocation;
  startLatitude: number;
  startLongitude: number;
  startHeading: number;
  startTimestamp: number;
  targetLatitude: number;
  targetLongitude: number;
  targetHeading: number;
  targetTimestamp: number;
};

const normalizeHeading = (heading: number) => ((heading % 360) + 360) % 360;

const getHeadingProgress = (
  now: number,
  startTimestamp: number,
  targetTimestamp: number
) => {
  if (targetTimestamp <= startTimestamp) {
    return 1;
  }
  const progress = (now - startTimestamp) / (targetTimestamp - startTimestamp);
  return Math.max(0, Math.min(1, progress));
};

const interpolateHeading = (
  startHeading: number,
  targetHeading: number,
  progress: number
) => {
  const rawDiff = ((targetHeading - startHeading + 540) % 360) - 180;
  const interpolated = startHeading + rawDiff * progress;
  return normalizeHeading(interpolated);
};

const interpolateObservation = (
  state: ObservationState,
  atTime: number
): Pick<VesselLocation, "Latitude" | "Longitude" | "Heading"> => {
  const latitude = lerp(
    atTime,
    state.startTimestamp,
    state.targetTimestamp,
    state.startLatitude,
    state.targetLatitude
  );
  const longitude = lerp(
    atTime,
    state.startTimestamp,
    state.targetTimestamp,
    state.startLongitude,
    state.targetLongitude
  );
  const progress = getHeadingProgress(
    atTime,
    state.startTimestamp,
    state.targetTimestamp
  );
  const heading = interpolateHeading(
    state.startHeading,
    state.targetHeading,
    progress
  );
  return { Latitude: latitude, Longitude: longitude, Heading: heading };
};

const computeSmoothedVessels = (
  state: Record<number, ObservationState>,
  atTime: number
): VesselLocation[] =>
  Object.values(state).map((observation) => {
    const interpolated = interpolateObservation(observation, atTime);
    return {
      ...observation.vessel,
      Latitude: interpolated.Latitude,
      Longitude: interpolated.Longitude,
      Heading: interpolated.Heading,
    };
  });

const calculateDistance = (vp1: VesselLocation, vp2: VesselLocation): number =>
  distance([vp1.Longitude, vp1.Latitude], [vp2.Longitude, vp2.Latitude], {
    units: "kilometers",
  });

export const useSmoothedVesselLocations = (
  currentVessels: VesselLocation[]
): VesselLocation[] => {
  const [smoothedVessels, setSmoothedVessels] = useState<VesselLocation[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const observationStateRef = useRef<Record<number, ObservationState>>({});

  useEffect(() => {
    const now = Date.now();
    const nextState: Record<number, ObservationState> = {};

    currentVessels.forEach((vessel) => {
      const existing = observationStateRef.current[vessel.VesselID];
      const projected = projectVesselLocation(vessel);
      const targetTimestamp = now + PROJECTION_TIME_MS;

      let startLatitude = vessel.Latitude;
      let startLongitude = vessel.Longitude;
      let startHeading = vessel.Heading;

      if (existing) {
        const lastObserved = interpolateObservation(existing, now);
        const lastObservedLocation = {
          ...vessel,
          Latitude: lastObserved.Latitude,
          Longitude: lastObserved.Longitude,
          Heading: lastObserved.Heading,
        };
        const hasTeleported =
          calculateDistance(lastObservedLocation, vessel) >
          TELEPORT_THRESHOLD_KM;
        if (!hasTeleported) {
          startLatitude = lastObserved.Latitude;
          startLongitude = lastObserved.Longitude;
          startHeading = lastObserved.Heading;
        }
      }

      nextState[vessel.VesselID] = {
        vessel,
        startLatitude,
        startLongitude,
        startHeading,
        startTimestamp: now,
        targetLatitude: projected.Latitude,
        targetLongitude: projected.Longitude,
        targetHeading: projected.Heading ?? vessel.Heading,
        targetTimestamp,
      };
    });

    observationStateRef.current = nextState;
    setSmoothedVessels(computeSmoothedVessels(nextState, now));
  }, [currentVessels]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setSmoothedVessels(
        computeSmoothedVessels(observationStateRef.current, now)
      );
    }, SMOOTHING_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return smoothedVessels;
};
