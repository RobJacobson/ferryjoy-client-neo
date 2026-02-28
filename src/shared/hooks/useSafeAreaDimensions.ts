import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Returns the usable screen dimensions after accounting for safe area insets
 * (status bar, home indicator, notches, etc.).
 *
 * @returns Object containing the dimensions within the safe area:
 *   - `safeAreaWidth` - Window width minus left and right safe area insets
 *   - `safeAreaHeight` - Window height minus top and bottom safe area insets
 *
 * @example
 * ```tsx
 * const { safeAreaWidth, safeAreaHeight } = useSafeAreaDimensions();
 * ```
 */
const useSafeAreaDimensions = () => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  return {
    safeAreaWidth: windowWidth - insets.left - insets.right,
    safeAreaHeight: windowHeight - insets.top - insets.bottom,
  };
};

export { useSafeAreaDimensions };
