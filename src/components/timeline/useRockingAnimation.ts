import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { INDICATOR_STYLE } from "./theme";

const speedToDurationMs = (speedKnots: number): number => {
  const {
    minSpeedKnots,
    maxSpeedKnots,
    periodSlowMs,
    periodFastMs,
  } = INDICATOR_STYLE.rocking;
  const range = maxSpeedKnots - minSpeedKnots;

  if (range <= 0) {
    return periodSlowMs;
  }

  const t = Math.min(1, Math.max(0, (speedKnots - minSpeedKnots) / range));
  return Math.round(periodSlowMs - (periodSlowMs - periodFastMs) * t);
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
    animate ? INDICATOR_STYLE.rocking.maxRotationDeg : 0
  );
  const speedRef = useRef(speedKnots);
  speedRef.current = speedKnots;

  const [cycle, setCycle] = useState(0);
  const startNextCycle = useCallback(() => setCycle((value) => value + 1), []);

  useEffect(() => {
    void cycle;

    if (!animate) {
      amplitude.value = withTiming(0, {
        duration: INDICATOR_STYLE.rocking.rampOutMs,
        easing: Easing.out(Easing.cubic),
      });
      cancelAnimation(phase);
      phase.value = 0;
      return;
    }

    amplitude.value = withTiming(INDICATOR_STYLE.rocking.maxRotationDeg, {
      duration: INDICATOR_STYLE.rocking.rampInMs,
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
    transform: [{ rotate: `${phaseToRotation(phase.value, amplitude.value)}deg` }],
  }));
};
