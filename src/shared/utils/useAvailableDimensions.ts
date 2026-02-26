import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Returns the available width and height of the screen after accounting for safe
 * area insets (status bar, home indicator, notches, etc.).
 *
 * @returns Object containing the dimensions usable within the safe area:
 *   - `availableWidth` - Window width minus left and right insets
 *   - `availableHeight` - Window height minus top and bottom insets
 *
 * @example
 * ```tsx
 * const { availableWidth, availableHeight } = useAvailableDimensions();
 * ```
 */
export function useAvailableDimensions() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  return {
    availableWidth: windowWidth - insets.left - insets.right,
    availableHeight: windowHeight - insets.top - insets.bottom,
  };
}
