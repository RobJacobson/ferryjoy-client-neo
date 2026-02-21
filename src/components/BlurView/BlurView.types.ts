/**
 * Shared BlurView props for platform-specific implementations.
 * Native uses expo-blur; web uses custom backdrop-filter (no saturate).
 */

import type { RefObject } from "react";
import type { View, ViewProps } from "react-native";

export type BlurMethod =
  | "none"
  | "dimezisBlurView"
  | "dimezisBlurViewSdk31Plus";

export type BlurTint =
  | "light"
  | "dark"
  | "default"
  | "extraLight"
  | "regular"
  | "prominent"
  | "systemUltraThinMaterial"
  | "systemThinMaterial"
  | "systemMaterial"
  | "systemThickMaterial"
  | "systemChromeMaterial"
  | "systemUltraThinMaterialLight"
  | "systemThinMaterialLight"
  | "systemMaterialLight"
  | "systemThickMaterialLight"
  | "systemChromeMaterialLight"
  | "systemUltraThinMaterialDark"
  | "systemThinMaterialDark"
  | "systemMaterialDark"
  | "systemThickMaterialDark"
  | "systemChromeMaterialDark";

export type BlurViewProps = {
  /** Ref to BlurTargetView; used on Android. Ignored on web. */
  blurTarget?: RefObject<View | null>;
  /** Blur intensity 1–100. */
  intensity?: number;
  /** Tint mode for overlay color. */
  tint?: BlurTint;
  /** Blur method (Android only). Ignored on web. */
  blurMethod?: BlurMethod;
} & ViewProps;
