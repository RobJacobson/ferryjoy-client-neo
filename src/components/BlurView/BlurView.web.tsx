/**
 * Web BlurView – custom implementation with backdrop-filter blur only.
 * Avoids expo-blur's hardcoded saturate(180%) which causes unnatural color distortion.
 */

import { StyleSheet, View } from "react-native";
import type { BlurTint, BlurViewProps } from "./BlurView.types";

/**
 * Returns background color for web blur overlay (from expo-blur getBackgroundColor).
 * Supports common tints; falls back to default for unsupported values.
 *
 * @param intensity - Blur intensity 1–100
 * @param tint - Tint mode
 * @returns rgba string for backgroundColor
 */
function getBackgroundColor(intensity: number, tint: BlurTint): string {
  const opacity = intensity / 100;
  switch (tint) {
    case "dark":
    case "systemMaterialDark":
      return `rgba(25,25,25,${opacity * 0.78})`;
    case "light":
    case "extraLight":
    case "systemMaterialLight":
    case "systemUltraThinMaterialLight":
    case "systemThickMaterialLight":
      return `rgba(249,249,249,${opacity * 0.78})`;
    case "default":
    case "prominent":
    case "systemMaterial":
      return `rgba(255,255,255,${opacity * 0.3})`;
    case "regular":
      return `rgba(179,179,179,${opacity * 0.82})`;
    case "systemThinMaterial":
      return `rgba(199,199,199,${opacity * 0.97})`;
    case "systemChromeMaterial":
      return `rgba(255,255,255,${opacity * 0.75})`;
    case "systemChromeMaterialLight":
      return `rgba(255,255,255,${opacity * 0.97})`;
    case "systemUltraThinMaterial":
    case "systemThickMaterial":
      return `rgba(191,191,191,${opacity * 0.44})`;
    case "systemThickMaterialDark":
      return `rgba(37,37,37,${opacity * 0.9})`;
    case "systemThinMaterialDark":
      return `rgba(37,37,37,${opacity * 0.7})`;
    case "systemUltraThinMaterialDark":
      return `rgba(37,37,37,${opacity * 0.55})`;
    case "systemChromeMaterialDark":
      return `rgba(0,0,0,${opacity * 0.75})`;
    case "systemThinMaterialLight":
      return `rgba(199,199,199,${opacity * 0.78})`;
    default:
      return `rgba(255,255,255,${opacity * 0.3})`;
  }
}

/**
 * Web BlurView with blur-only backdrop-filter (no saturate).
 * Fixes color distortion from expo-blur's hardcoded saturate(180%).
 * Uses clip-path to clip blur to rounded corners (backdrop-filter ignores border-radius in some browsers).
 */
export const BlurView = ({
  intensity = 50,
  tint = "default",
  style,
  ...props
}: BlurViewProps) => {
  const cappedIntensity = Math.min(intensity ?? 50, 100);
  const blurPx = cappedIntensity * 0.2;
  const blur = `blur(${blurPx}px)`;
  const backgroundColor = getBackgroundColor(
    cappedIntensity,
    tint ?? "default"
  );

  // Extract borderRadius from style for clip-path (backdrop-filter bleeds past border-radius otherwise)
  const flattenedStyle = style ? StyleSheet.flatten(style) : {};
  const borderRadius = flattenedStyle.borderRadius ?? 24;
  const clipPath = `inset(0 round ${borderRadius}px)`;

  const blurStyle = {
    backgroundColor,
    backdropFilter: blur,
    overflow: "hidden" as const,
    borderRadius,
    clipPath,
    WebkitBackdropFilter: blur,
  } as import("react-native").ViewStyle & { clipPath?: string };

  // Wrapper clips blur to rounded corners (same pattern as native; clip-path handles browsers where overflow doesn't)
  return (
    <View style={[style, { overflow: "hidden", borderRadius }]}>
      <View {...props} style={[StyleSheet.absoluteFillObject, blurStyle]} />
    </View>
  );
};
