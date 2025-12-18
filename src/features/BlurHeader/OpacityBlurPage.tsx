import type React from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  OpacityBlurOverlay,
  type OpacityBlurOverlayProps,
} from "./OpacityBlurOverlay";

export type OpacityBlurPageLayout = {
  /** Total overlay height (safe area + nav). */
  contentInsetTop: number;
  /** Safe area inset at the top (notch/status bar). */
  safeAreaTop: number;
  /** The nav/header portion below the safe area inset. */
  navBarHeight: number;
};

export type OpacityBlurPageProps = {
  /**
   * If you pass a function, you get `contentInsetTop` for ScrollView padding.
   * If you pass a node, it’s rendered as-is.
   */
  children:
    | React.ReactNode
    | ((layout: OpacityBlurPageLayout) => React.ReactNode);

  /** Height of the header area below the notch/status bar. */
  navBarHeight?: number;

  /** Style for the page container. */
  style?: StyleProp<ViewStyle>;

  /** Props forwarded into the overlay renderer. */
  overlayProps?: Omit<
    OpacityBlurOverlayProps,
    "position" | "height" | "extendIntoNotch"
  >;
};

/**
 * Screen wrapper that adds a Contacts-style opacity blur header overlay.
 * It also hands you the correct `contentInsetTop` so ScrollViews can start below the header,
 * while still allowing content to scroll underneath the glass.
 */
export function OpacityBlurPage({
  children,
  navBarHeight = 56,
  style,
  overlayProps,
}: OpacityBlurPageProps) {
  const insets = useSafeAreaInsets();

  const contentInsetTop = insets.top + navBarHeight;

  return (
    <View style={[{ flex: 1 }, style]}>
      <OpacityBlurOverlay
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
}
