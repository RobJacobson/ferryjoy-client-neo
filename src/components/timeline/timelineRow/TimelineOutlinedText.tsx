/**
 * Duplicates a text child at pixel offsets to synthesize an outline stroke.
 */

import { type ComponentProps, cloneElement, type ReactElement } from "react";
import type { TextStyle } from "react-native";
import { type Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";

type TimelineOutlinedTextProps = {
  children: ReactElement<ComponentProps<typeof Text>>;
  containerClassName?: string;
  outlineClassName?: string;
  outlineStyle?: TextStyle;
  outlineWidth?: number;
};

/**
 * Renders ghost copies of `children` around the original for a bold outline.
 *
 * @param children - Single `Text` element to outline
 * @param containerClassName - Optional wrapper classes
 * @param outlineClassName - Classes applied to each outline duplicate
 * @param outlineStyle - Style merged into duplicates (typically outline color)
 * @param outlineWidth - Pixel radius of the offset grid (default 1)
 * @returns Stacked absolute duplicates plus the original child on top
 */
export const TimelineOutlinedText = ({
  children,
  containerClassName,
  outlineClassName,
  outlineStyle,
  outlineWidth = 1,
}: TimelineOutlinedTextProps) => {
  const outlineOffsets: Array<{ x: number; y: number }> = [];

  for (let x = -outlineWidth; x <= outlineWidth; x += 1) {
    for (let y = -outlineWidth; y <= outlineWidth; y += 1) {
      if (x === 0 && y === 0) {
        continue;
      }

      outlineOffsets.push({ x, y });
    }
  }

  const resolvedOutlineClassName = outlineClassName ?? "";
  const resolvedOutlineStyle = outlineStyle ?? {
    color: "rgba(255, 255, 255, 1)",
  };

  return (
    <View className={cn("relative", containerClassName)}>
      {outlineOffsets.map(({ x, y }) => (
        <View
          key={`${x}:${y}`}
          className="absolute"
          style={{ left: x, top: y }}
        >
          {cloneElement(children, {
            className: cn(children.props.className, resolvedOutlineClassName),
            style: [children.props.style, resolvedOutlineStyle],
          })}
        </View>
      ))}
      {children}
    </View>
  );
};
