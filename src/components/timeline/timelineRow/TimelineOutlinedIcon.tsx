import { cloneElement, type ReactElement } from "react";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";

type TimelineOutlinedIconProps = {
  children: ReactElement;
  containerClassName?: string;
  outlineColor?: string;
  outlineWidth?: number;
};

const getOutlineOffsets = (outlineWidth: number) => {
  const offsets: Array<{ x: number; y: number }> = [];

  for (let x = -outlineWidth; x <= outlineWidth; x += 1) {
    for (let y = -outlineWidth; y <= outlineWidth; y += 1) {
      if (x === 0 && y === 0) {
        continue;
      }

      offsets.push({ x, y });
    }
  }

  return offsets;
};

export const TimelineOutlinedIcon = ({
  children,
  containerClassName,
  outlineColor = "#FFFFFF",
  outlineWidth = 1,
}: TimelineOutlinedIconProps) => {
  const outlineOffsets = getOutlineOffsets(outlineWidth);
  const childProps = children.props as { color?: string; strokeWidth?: number };

  return (
    <View className={cn("relative", containerClassName)}>
      {outlineOffsets.map(({ x, y }) => (
        <View
          key={`${x}:${y}`}
          className="absolute"
          style={{ left: x, top: y }}
        >
          {cloneElement(children, {
            color: outlineColor,
            strokeWidth:
              childProps.strokeWidth !== undefined
                ? childProps.strokeWidth + outlineWidth
                : undefined,
          })}
        </View>
      ))}
      {children}
    </View>
  );
};
