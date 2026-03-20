/**
 * Shared BlurView props for platform-specific implementations.
 * Native uses expo-blur; web uses custom backdrop-filter (no saturate).
 */

import type { ComponentRef, RefObject } from "react";
import type { View, ViewProps } from "react-native";

export type BlurMethod =
  | "none"
  | "dimezisBlurView"
  | "dimezisBlurViewSdk31Plus";

export type BlurTint =
  | "clear"
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
  blurTarget?: RefObject<ComponentRef<typeof View> | null>;
  /** Blur intensity 1–100. */
  intensity?: number;
  /**
   * Material-style overlay on top of the blur. Use `"clear"` for backdrop blur
   * only (transparent overlay on web; thinnest material on native).
   */
  tint?: BlurTint;
  /** Blur method (Android only). Ignored on web. */
  blurMethod?: BlurMethod;
} & ViewProps;
