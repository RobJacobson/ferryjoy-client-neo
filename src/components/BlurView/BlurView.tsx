/**
 * Native BlurView – wraps expo-blur in a clipping container for rounded corners.
 * UIVisualEffectView does not respect borderRadius; overflow: hidden on the wrapper clips it.
 */

import { BlurView as ExpoBlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { View } from "@/components/ui";
import type { BlurViewProps } from "./BlurView.types";

/**
 * Native BlurView with rounded-corner clipping.
 * Wraps expo-blur in a View with overflow: hidden so the blur is clipped to border-radius.
 */
export const BlurView = (props: BlurViewProps) => {
  const { style, className, children, ...rest } = props;

  return (
    <View style={[style, { overflow: "hidden" }]} className={className}>
      <ExpoBlurView {...rest} style={StyleSheet.absoluteFill}>
        {children}
      </ExpoBlurView>
    </View>
  );
};
