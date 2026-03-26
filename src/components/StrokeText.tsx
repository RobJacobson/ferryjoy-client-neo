import { Text as RNText, type StyleProp, type TextStyle } from "react-native";
import { View } from "@/components/ui";

const OUTLINE_OFFSETS = {
  1: [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ],
  2: [
    { x: -2, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: -2 },
    { x: 0, y: 2 },
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: -2, y: 2 },
    { x: 2, y: 2 },
    { x: -2, y: -1 },
    { x: -2, y: 1 },
    { x: 2, y: -1 },
    { x: 2, y: 1 },
    { x: -1, y: -2 },
    { x: 1, y: -2 },
    { x: -1, y: 2 },
    { x: 1, y: 2 },
  ],
} as const;

type StrokeTextProps = {
  children: string;
  style: StyleProp<TextStyle>;
  outlineColor: string;
  outlineWidth?: 1 | 2;
  accessible?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Decorative display text that synthesizes a small outline with a fixed set of
 * native text clones. This stays fast across native and web while keeping the
 * accessibility surface on the outer wrapper only.
 */
export const StrokeText = ({
  children,
  style,
  outlineColor,
  outlineWidth = 1,
  accessible,
  accessibilityLabel,
  testID,
}: StrokeTextProps) => {
  const isAccessible = accessible ?? true;
  const derivedAccessibilityLabel = accessibilityLabel ?? children;
  const outlineOffsets = OUTLINE_OFFSETS[outlineWidth];

  return (
    <View
      accessible={isAccessible}
      accessibilityLabel={isAccessible ? derivedAccessibilityLabel : undefined}
      accessibilityRole={isAccessible ? "text" : undefined}
      className="relative self-start"
      testID={testID}
    >
      {outlineOffsets.map(({ x, y }) => (
        <View
          key={`${x}:${y}`}
          accessibilityElementsHidden
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={{
            left: x,
            position: "absolute",
            top: y,
          }}
        >
          <RNText
            accessibilityElementsHidden
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[style, { color: outlineColor }]}
          >
            {children}
          </RNText>
        </View>
      ))}
      <RNText
        accessibilityElementsHidden
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={style}
      >
        {children}
      </RNText>
    </View>
  );
};
