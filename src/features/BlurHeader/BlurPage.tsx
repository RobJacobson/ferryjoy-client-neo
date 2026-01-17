import { type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurOverlay } from "./BlurOverlay";
import type { BlurOverlayProps } from "./utils";

export type BlurPageLayout = {
  /** Total overlay height (safe area + nav). */
  contentInsetTop: number;
  /** Safe area inset at the top (notch/status bar). */
  safeAreaTop: number;
  /** The nav/header portion below the safe area inset. */
  navBarHeight: number;
};

export interface BlurPageProps {
  /**
   * If you pass a function, you get `contentInsetTop` for ScrollView padding.
   * If you pass a node, it's rendered as-is.
   */
  children: React.ReactNode | ((layout: BlurPageLayout) => React.ReactNode);

  /** Height of the header area below the notch/status bar. */
  navBarHeight?: number;

  /** Style for the page container. */
  style?: StyleProp<ViewStyle>;

  /** Props forwarded into the overlay renderer. */
  overlayProps?: Omit<
    BlurOverlayProps,
    "position" | "height" | "extendIntoNotch"
  >;
}

/**
 * ⚠️ DEPRECATED: This component has been replaced by `GlassHeader` which uses
 * Expo's native `expo-glass-effect` package for authentic iOS 26 liquid glass effects.
 *
 * Screen wrapper that adds a blur header overlay with both blur and opacity gradients.
 *
 * This component combines both:
 * 1. Progressive blur gradient (content becomes more blurry as it scrolls up) - optional
 * 2. Progressive opacity gradient (tint fades out as it approaches content)
 *
 * It also hands you the correct `contentInsetTop` so ScrollViews can start below the header,
 * while still allowing content to scroll underneath the glass.
 *
 * When blurAmount is 0 (default), only opacity gradient is applied.
 * When blurAmount > 0, both blur and opacity gradients are combined.
 */
export const BlurPage: React.FC<BlurPageProps> = ({
  children,
  navBarHeight = 56,
  style,
  overlayProps,
}) => {
  const insets = useSafeAreaInsets();

  const contentInsetTop = insets.top + navBarHeight;

  return (
    <View className="flex-1" style={style}>
      <BlurOverlay
        position="top"
        height={contentInsetTop}
        extendIntoNotch={true}
        {...overlayProps}
      />

      {typeof children === "function"
        ? children({
            contentInsetTop,
            safeAreaTop: insets.top,
            navBarHeight,
          })
        : children}
    </View>
  );
};
