import React from "react";
import { AccessibilityInfo, Platform } from "react-native";

export type BlurOverlayPosition = "top" | "bottom";

export interface BlurOverlayProps {
  /** Where to render the overlay. */
  position?: BlurOverlayPosition;

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

  /** Glass tint color (used for opacity tint overlay). */
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

  /**
   * Blur intensity (0-100). When 0, only opacity gradient is applied.
   * When > 0, progressive blur gradient is applied.
   */
  blurAmount?: number;

  /**
   * Blur type for ProgressiveBlurView.
   * Options: 'light', 'dark', 'xlight', 'extraDark'
   */
  blurType?: "light" | "dark" | "xlight" | "extraDark";

  /**
   * Direction of blur gradient.
   * 'blurredTopClearBottom' = blur at top, clear at bottom (default for top position)
   * 'blurredBottomClearTop' = blur at bottom, clear at top (default for bottom position)
   */
  blurDirection?: "blurredTopClearBottom" | "blurredBottomClearTop";

  /**
   * Starting offset for blur gradient (0-1).
   * 0 = blur starts immediately, 1 = blur starts at bottom
   */
  blurStartOffset?: number;

  /** zIndex for overlay stacking. */
  zIndex?: number;

  /** Extra style overrides for the outer container. */
  style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
}

export type RenderProps = {
  tintColor: string;
  opacity: number;
  fadeStartClamped: number;
  blurAmount: number;
  blurType: "light" | "dark" | "xlight" | "extraDark";
  blurDirection: "blurredTopClearBottom" | "blurredBottomClearTop";
  blurStartOffset: number;
  height: number;
  position: BlurOverlayPosition;
  hasBlur: boolean;
  useMaskedFade: boolean;
};

export const useBlurOverlaySetup = (props: BlurOverlayProps) => {
  const {
    position = "top",
    height,
    extendIntoNotch,
    tintColor = "#FFFFFF",
    opacity = 0.5,
    progressive = true,
    fadeStart = 0.35,
    blurAmount = 0,
    blurType = "light",
    blurDirection,
    blurStartOffset = 0,
    zIndex = 1000,
    style,
  } = props;

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
          "BlurOverlay: Failed to check transparency settings:",
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
        "BlurOverlay: Failed to add transparency change listener:",
        error
      );
    }

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  // Validate and clamp input values
  const fadeStartClamped = Math.max(0, Math.min(1, fadeStart));
  const opacityClamped = Math.max(0, Math.min(1, opacity));
  const blurAmountClamped = Math.max(0, Math.min(100, blurAmount));
  const blurStartOffsetClamped = Math.max(0, Math.min(1, blurStartOffset));

  // Default blur direction based on position
  const resolvedBlurDirection =
    blurDirection ??
    (position === "top" ? "blurredTopClearBottom" : "blurredBottomClearTop");

  const hasBlur = blurAmountClamped > 0 && Platform.OS !== "web";
  const useMaskedFade =
    progressive &&
    position === "top" &&
    Platform.OS !== "web" &&
    !reduceTransparencyEnabled;

  return {
    position,
    height,
    extendIntoNotch,
    tintColor,
    opacity: opacityClamped,
    fadeStartClamped,
    blurAmount: blurAmountClamped,
    blurType,
    blurDirection: resolvedBlurDirection,
    blurStartOffset: blurStartOffsetClamped,
    zIndex,
    style,
    reduceTransparencyEnabled,
    hasBlur,
    useMaskedFade,
  };
};

/**
 * Utility functions for blur overlay components
 */

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Convert hex color to rgba with specified alpha
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const a = clamp01(alpha);
  const raw = hex.replace("#", "").trim();
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;

  if (normalized.length !== 6) {
    // Fallback to a readable default.
    return `rgba(255,255,255,${a})`;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  if (![r, g, b].every((v) => Number.isFinite(v))) {
    return `rgba(255,255,255,${a})`;
  }

  return `rgba(${r},${g},${b},${a})`;
};

/**
 * Resolve fallback color for reduced transparency mode
 */
export const resolveReducedTransparencyFallbackColor = (
  tintColor: string,
  opacity: number
): string => {
  // When "Reduce Transparency" is enabled, we should still show an opaque-enough color.
  // We'll use the same tint but slightly higher alpha so it's still readable.
  return hexToRgba(tintColor, clamp01(Math.max(opacity, 0.85)));
};
