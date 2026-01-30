// ============================================================================
// Animated Waves Component
// ============================================================================
// Renders a layered stack of animated waves with varying properties
// Creates a depth effect through multiple wave layers with different colors
// ============================================================================

import type React from "react";
import { ScrollView, View } from "react-native";
import { AnimatedWave } from "./AnimatedWave";
import { createColorGenerator } from "@/shared/utils";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Color generator for blue shades, using blue-500 as base color.
 */
const blueColor = createColorGenerator("#3b82f6");

/**
 * Color generator for green shades, using green-500 as base color.
 */
const greenColor = createColorGenerator("#22c55e");

/**
 * Starting period for the first wave layer.
 */
const periodStart = 60;

/**
 * Increment in period for each subsequent wave layer.
 */
const periodDelta = 60;

/**
 * Starting height (vertical position) for the first wave layer.
 */
const heightStart = 60;

/**
 * Vertical position delta for each subsequent wave layer.
 */
const heightDelta = -5;

/**
 * Starting amplitude for the first wave layer.
 */
const amplitudeStart = 4;

/**
 * Amplitude delta for each subsequent wave layer.
 */
const amplitudeDelta = 4;

/**
 * Number of wave layers to render.
 */
const waveCount = 8;

/**
 * Total width of the waves container in pixels.
 */
const containerWidth = 2400;

/**
 * Margin offset on left and right sides in pixels.
 */
const marginOffset = -200;

/**
 * Bottom offset for the entire wave container in pixels.
 */
const bottomOffset = -10;

/**
 * Margin offset for the foreground grass layer in pixels.
 */
const grassMarginBottom = -10;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AnimatedWaves component that renders a layered stack of animated waves.
 *
 * Creates a depth effect by stacking multiple wave layers with varying
 * amplitudes, periods, and colors. Includes a foreground grass layer.
 */
export const AnimatedWaves: React.FC = () => {
  return (
    <ScrollView
      className="flex-1 bg-white"
      horizontal
      contentContainerClassName="h-full"
      showsHorizontalScrollIndicator={false}
    >
      <View
        style={{
          width: containerWidth,
          marginLeft: marginOffset,
          marginRight: marginOffset,
          bottom: bottomOffset,
        }}
      >
        {/* Foreground grass */}
        <View
          className="absolute inset-0"
          style={{ zIndex: 100, marginBottom: grassMarginBottom }}
        >
          <AnimatedWave
            amplitude={5}
            period={250}
            fillColor={greenColor(500)}
            height={15}
          />
        </View>

        {/* Wave layers */}
        {Array.from({ length: waveCount }).map((_, index) => (
          <View
            key={index}
            className="absolute inset-0"
            style={{ zIndex: index + 1 }}
          >
            <AnimatedWave
              amplitude={amplitudeStart + index * amplitudeDelta}
              period={periodStart + index * periodDelta}
              fillColor={blueColor(200 + index * 50)}
              height={heightStart + index * heightDelta}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};
