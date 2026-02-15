/**
 * useIsLandscape
 *
 * Returns true when the screen is in landscape orientation. Uses
 * expo-screen-orientation's getOrientationAsync for reliable native detection
 * (avoids useWindowDimensions which can report reversed values on iPad).
 * Falls back to width > height on web where the orientation API has limited support.
 */

import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

const LANDSCAPE_ORIENTATIONS: number[] = [
  ScreenOrientation.Orientation.LANDSCAPE_LEFT,
  ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
];

/**
 * Returns true when the screen is in landscape orientation.
 * Uses the native orientation API on iOS/Android for correct iPad detection.
 * Falls back to width > height on web.
 *
 * @returns true if landscape, false if portrait
 */
export const useIsLandscape = (): boolean => {
  const { width, height } = useWindowDimensions();

  // Native: use expo-screen-orientation. Default true to avoid insufficient
  // width before async resolves (guarantees we never run out of texture).
  const [isLandscape, setIsLandscape] = useState<boolean>(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    const updateOrientation = (orientation: number) => {
      setIsLandscape(LANDSCAPE_ORIENTATIONS.includes(orientation));
    };

    let subscription: { remove: () => void } | null = null;

    const init = async () => {
      try {
        const orientation = await ScreenOrientation.getOrientationAsync();
        updateOrientation(orientation);

        subscription = ScreenOrientation.addOrientationChangeListener(
          (event) => {
            updateOrientation(event.orientationInfo.orientation);
          }
        );
      } catch {
        setIsLandscape(width > height);
      }
    };

    init();

    return () => {
      subscription?.remove();
    };
  }, [width, height]);

  if (Platform.OS === "web") {
    return width > height;
  }

  return isLandscape;
};
