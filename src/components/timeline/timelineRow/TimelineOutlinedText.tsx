/**
 * Duplicates a text child at pixel offsets to synthesize an outline stroke.
 */

import { type ComponentProps, cloneElement, type ReactElement } from "react";
import { type Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DEFAULT_TIMELINE_OUTLINE_COLOR } from "../theme";

type TimelineOutlinedTextProps = {
  children: ReactElement<ComponentProps<typeof Text>>;
  containerClassName?: string;
  outlineColor?: string;
  outlineWidth?: number;
};

/**
 * Renders ghost copies of `children` around the original for a bold outline.
 *
 * @param children - Single `Text` element to outline
 * @param containerClassName - Optional wrapper classes
 * @param outlineColor - HSLA outline color used for all duplicate layers
 * @param outlineWidth - Pixel radius of the offset grid (default 1)
 * @returns Stacked absolute duplicates plus the original child on top
 */
export const TimelineOutlinedText = ({
  children,
  containerClassName,
  outlineColor = DEFAULT_TIMELINE_OUTLINE_COLOR,
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

  return (
    <View className={cn("relative", containerClassName)}>
      {outlineOffsets.map(({ x, y }) => (
        <View
          key={`${x}:${y}`}
          className="absolute"
          style={{ left: x, top: y }}
        >
          {cloneElement(children, {
            className: children.props.className,
            style: [children.props.style, { color: outlineColor }],
          })}
        </View>
      ))}
      {children}
    </View>
  );
};
