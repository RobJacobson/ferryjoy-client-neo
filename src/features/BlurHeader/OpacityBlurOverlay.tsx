import MaskedView from "@react-native-masked-view/masked-view";
import React from "react";
import {
  AccessibilityInfo,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { hexToRgba } from "./opacityBlurUtils";

export type OpacityBlurOverlayPosition = "top" | "bottom";

export interface OpacityBlurOverlayProps {
  /** Where to render the overlay. */
  position?: OpacityBlurOverlayPosition;

  /**
   * Explicit overlay height.
   * If omitted:
   * - top: uses safe area inset height
   * - bottom: uses safe area inset height
   */
  height?: number;

  /**
   * For `position="top"`, when `true` the overlay starts at y=0 (covers the notch area).
   * When `false`, the overlay starts below the safe area inset (useful for "nav only" overlays).
   */
  extendIntoNotch?: boolean;

  /** Glass tint color (used for fallback opacity tint + reduced transparency fallback). */
  tintColor?: string;

  /** Max opacity near the notch/status bar. */
  opacity?: number;

  /**
   * Progressive layered effect (recommended for iOS 26 "contact" style headers).
   * Contacts-style header: tint that fades out as it approaches content.
   */
  progressive?: boolean;

  /**
   * Where the fade-out begins (0..1 of overlay height).
   * 0.0 = start fading immediately, 1.0 = no fade (not recommended).
   */
  fadeStart?: number;

  /** zIndex for overlay stacking. */
  zIndex?: number;

  /** Extra style overrides for the outer container. */
  style?: StyleProp<ViewStyle>;
}

type RenderProps = {
  tintColor: string;
  opacity: number;
  fadeStartClamped: number;
};

function renderReducedTransparencyMode({
  tintColor,
  opacity,
}: Pick<RenderProps, "tintColor" | "opacity">) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: hexToRgba(tintColor, Math.max(opacity, 0.9)) },
      ]}
    />
  );
}

function renderWebMode({
  tintColor,
  opacity,
  fadeStartClamped,
}: Pick<RenderProps, "tintColor" | "opacity" | "fadeStartClamped">) {
  // Simple lerp gradient: full opacity until fadeStart, then lerp to transparent
  const startOpacity = 1;
  const endOpacity = 0;
  const fadeStartPercent = fadeStartClamped * 100;

  const smoothGradient = `linear-gradient(to bottom, 
    rgba(0,0,0,${startOpacity}) 0%, 
    rgba(0,0,0,${startOpacity}) ${fadeStartPercent}%, 
    rgba(0,0,0,${endOpacity}) 100%)`;

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: hexToRgba(tintColor, opacity),
          ...({
            maskImage: smoothGradient,
            WebkitMaskImage: smoothGradient,
          } as const satisfies Record<string, string>),
        },
      ]}
    />
  );
}

function renderMaskedMode({
  tintColor,
  opacity,
  fadeStartClamped,
}: Pick<RenderProps, "tintColor" | "opacity" | "fadeStartClamped">) {
  // Simple lerp gradient: full opacity at top (notch), fading to transparent at bottom
  const startOpacity = 1;
  const endOpacity = 0;

  // Create the mask element
  const maskElement = (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="opacityMask" x1="0" y1="0" x2="0" y2="1">
            {/* Full opacity at top (notch area) */}
            <Stop offset="0" stopColor="#fff" stopOpacity={startOpacity} />
            <Stop
              offset={String(fadeStartClamped)}
              stopColor="#fff"
              stopOpacity={startOpacity}
            />
            {/* Lerp to transparent at bottom */}
            <Stop offset="1" stopColor="#fff" stopOpacity={endOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#opacityMask)" />
      </Svg>
    </View>
  );

  return (
    <MaskedView style={StyleSheet.absoluteFill} maskElement={maskElement}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: hexToRgba(tintColor, opacity) },
        ]}
      />
    </MaskedView>
  );
}

function renderFallbackMode({
  tintColor,
  opacity,
}: Pick<RenderProps, "tintColor" | "opacity">) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: hexToRgba(tintColor, opacity),
        },
      ]}
    />
  );
}

export function OpacityBlurOverlay({
  position = "top",
  height,
  extendIntoNotch,
  tintColor = "#FFFFFF",
  opacity = 0.5,
  progressive = true,
  fadeStart = 0.35,
  zIndex = 1000,
  style,
}: OpacityBlurOverlayProps) {
  const insets = useSafeAreaInsets();

  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] =
    React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReduceTransparencyEnabled(Boolean(enabled));
      })
      .catch((error) => {
        console.warn(
          "OpacityBlurOverlay: Failed to check transparency settings:",
          error
        );
        // Continue with default behavior (glass/blur enabled)
      });

    let subscription: ReturnType<
      typeof AccessibilityInfo.addEventListener
    > | null = null;
    try {
      subscription = AccessibilityInfo.addEventListener(
        "reduceTransparencyChanged",
        (enabled) => {
          if (mounted) setReduceTransparencyEnabled(Boolean(enabled));
        }
      );
    } catch (error) {
      console.warn(
        "OpacityBlurOverlay: Failed to add transparency change listener:",
        error
      );
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  const isTop = position === "top";
  const defaultInsetHeight = isTop ? insets.top : insets.bottom;

  const resolvedHeight = height ?? defaultInsetHeight;
  if (!resolvedHeight || resolvedHeight <= 0) {
    console.warn(
      "OpacityBlurOverlay: Invalid height provided, component will not render"
    );
    return null;
  }

  const resolvedExtendIntoNotch = extendIntoNotch ?? position === "top";

  const top = isTop ? (resolvedExtendIntoNotch ? 0 : insets.top) : undefined;
  const bottom = !isTop ? 0 : undefined;

  // Validate and clamp input values
  const fadeStartClamped = Math.max(0, Math.min(1, fadeStart));
  const opacityClamped = Math.max(0, Math.min(1, opacity));

  const useMaskedFade =
    progressive &&
    position === "top" &&
    Platform.OS !== "web" &&
    !reduceTransparencyEnabled;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top,
          bottom,
          height: resolvedHeight,
          zIndex,
        },
        style,
      ]}
    >
      {reduceTransparencyEnabled
        ? renderReducedTransparencyMode({ tintColor, opacity: opacityClamped })
        : Platform.OS === "web"
          ? renderWebMode({
              tintColor,
              opacity: opacityClamped,
              fadeStartClamped,
            })
          : useMaskedFade
            ? renderMaskedMode({
                tintColor,
                opacity: opacityClamped,
                fadeStartClamped,
              })
            : renderFallbackMode({
                tintColor,
                opacity: opacityClamped,
              })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
});
