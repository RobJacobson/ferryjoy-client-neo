/**
 * Native BlurView – wraps expo-blur in a clipping container for rounded corners.
 * UIVisualEffectView does not respect borderRadius; overflow: hidden on the wrapper clips it.
 */

import { BlurView as ExpoBlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import type { BlurViewProps } from "./BlurView.types";

/**
 * Native BlurView with rounded-corner clipping.
 * Wraps expo-blur in a View with overflow: hidden so the blur is clipped to border-radius.
 */
export const BlurView = (props: BlurViewProps) => {
  const { style, children, ...rest } = props;
  const flattened = StyleSheet.flatten(style) ?? {};
  const borderRadius = flattened.borderRadius ?? 24;

  return (
    <View style={[style, { overflow: "hidden", borderRadius }]}>
      <ExpoBlurView {...rest} style={StyleSheet.absoluteFillObject}>
        {children}
      </ExpoBlurView>
    </View>
  );
};
