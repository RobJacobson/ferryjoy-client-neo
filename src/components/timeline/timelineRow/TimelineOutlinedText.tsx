import { type ComponentProps, cloneElement, type ReactElement } from "react";
import type { TextStyle } from "react-native";
import { type Text, View } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOutlineOffsets } from "./getOutlineOffsets";

type TimelineOutlinedTextProps = {
  children: ReactElement<ComponentProps<typeof Text>>;
  containerClassName?: string;
  outlineClassName?: string;
  outlineStyle?: TextStyle;
  outlineWidth?: number;
};

export const TimelineOutlinedText = ({
  children,
  containerClassName,
  outlineClassName,
  outlineStyle,
  outlineWidth = 1,
}: TimelineOutlinedTextProps) => {
  const outlineOffsets = getOutlineOffsets(outlineWidth);
  const resolvedOutlineClassName = outlineClassName || "text-white/80";
  const resolvedOutlineStyle = outlineStyle || {
    color: "rgba(255, 255, 255, 0.8)",
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
