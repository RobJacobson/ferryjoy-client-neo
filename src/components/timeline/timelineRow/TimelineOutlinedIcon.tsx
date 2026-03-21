import { cloneElement, type ReactElement } from "react";
import { View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOutlineOffsets } from "./getOutlineOffsets";

type TimelineOutlinedIconChildProps = {
  color?: string;
  strokeWidth?: number;
};

type TimelineOutlinedIconProps = {
  children: ReactElement<TimelineOutlinedIconChildProps>;
  containerClassName?: string;
  outlineColor?: string;
  outlineWidth?: number;
};

export const TimelineOutlinedIcon = ({
  children,
  containerClassName,
  outlineColor = "rgba(255, 255, 255, 0.8)",
  outlineWidth = 1,
}: TimelineOutlinedIconProps) => {
  const outlineOffsets = getOutlineOffsets(outlineWidth);
  const childProps = children.props;

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
