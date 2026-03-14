import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const ROCKING_MIN_SPEED_KNOTS = 0;
const ROCKING_MAX_SPEED_KNOTS = 20;
const ROCKING_PERIOD_SLOW_MS = 25000;
const ROCKING_PERIOD_FAST_MS = 7500;
const ROCKING_MAX_ROTATION_DEG = 4;
const ROCKING_RAMP_IN_MS = 900;
const ROCKING_RAMP_OUT_MS = 700;

const speedToDurationMs = (speedKnots: number): number => {
  const range = ROCKING_MAX_SPEED_KNOTS - ROCKING_MIN_SPEED_KNOTS;

  if (range <= 0) {
    return ROCKING_PERIOD_SLOW_MS;
  }

  const t = Math.min(
    1,
    Math.max(0, (speedKnots - ROCKING_MIN_SPEED_KNOTS) / range)
  );
  return Math.round(
    ROCKING_PERIOD_SLOW_MS -
      (ROCKING_PERIOD_SLOW_MS - ROCKING_PERIOD_FAST_MS) * t
  );
};

const phaseToRotation = (phase: number, maxDeg: number): number => {
  "worklet";

  if (phase <= 0.5) {
    const t = phase / 0.5;
    const eased = Easing.inOut(Easing.sin)(t);
    return -maxDeg + 2 * maxDeg * eased;
  }

  const t = (phase - 0.5) / 0.5;
  const eased = Easing.inOut(Easing.sin)(t);
  return maxDeg - 2 * maxDeg * eased;
};

export const useRockingAnimation = (animate: boolean, speedKnots: number) => {
  const phase = useSharedValue(0);
  const amplitude = useSharedValue(
    animate ? ROCKING_MAX_ROTATION_DEG : 0
  );
  const speedRef = useRef(speedKnots);
  speedRef.current = speedKnots;

  const [cycle, setCycle] = useState(0);
  const startNextCycle = useCallback(() => setCycle((value) => value + 1), []);

  useEffect(() => {
    void cycle;

    if (!animate) {
      amplitude.value = withTiming(0, {
        duration: ROCKING_RAMP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      });
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }

    amplitude.value = withTiming(ROCKING_MAX_ROTATION_DEG, {
      duration: ROCKING_RAMP_IN_MS,
      easing: Easing.out(Easing.cubic),
    });

    cancelAnimation(phase);
    phase.value = 0;
    phase.value = withTiming(
      1,
      {
        duration: speedToDurationMs(speedRef.current),
        easing: Easing.linear,
      },
      (finished) => {
        "worklet";
        if (!finished) {
          return;
        }
        scheduleOnRN(startNextCycle);
      }
    );

    return () => cancelAnimation(phase);
  }, [amplitude, animate, cycle, phase, startNextCycle]);

  return useAnimatedStyle(() => ({
    transform: [
      { rotate: `${phaseToRotation(phase.value, amplitude.value)}deg` },
    ],
  }));
};
