/**
 * Offset duplicate of a text child for a simple drop-shadow legibility effect.
 */

import { type ComponentProps, cloneElement, type ReactElement } from "react";
import type { TextStyle } from "react-native";
import { type Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";

type ShadowOffset = {
  x: number;
  y: number;
};

type TimelineShadowTextProps = {
  children: ReactElement<ComponentProps<typeof Text>>;
  containerClassName?: string;
  shadowClassName?: string;
  shadowStyle?: TextStyle;
  shadowOffset?: ShadowOffset;
};

const DEFAULT_SHADOW_OFFSET: ShadowOffset = {
  x: -2,
  y: 2,
};

/**
 * Renders a shifted clone under the primary text for contrast on busy fills.
 *
 * @param children - Single `Text` element to shadow
 * @param containerClassName - Optional wrapper classes
 * @param shadowClassName - Classes for the duplicate (default light fill)
 * @param shadowStyle - Optional extra style on the duplicate
 * @param shadowOffset - Pixel offset of the shadow layer
 * @returns Relative wrapper with shadow duplicate and original child
 */
export const TimelineShadowText = ({
  children,
  containerClassName,
  shadowClassName = "text-white",
  shadowStyle,
  shadowOffset = DEFAULT_SHADOW_OFFSET,
}: TimelineShadowTextProps) => (
  <View className={cn("relative", containerClassName)}>
    <View
      className="absolute"
      style={{ left: shadowOffset.x, top: shadowOffset.y }}
    >
      {cloneElement(children, {
        className: cn(children.props.className, shadowClassName),
        style: [children.props.style, shadowStyle],
      })}
    </View>
    {children}
  </View>
);
