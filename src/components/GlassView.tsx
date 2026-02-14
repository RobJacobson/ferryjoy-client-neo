/**
 * GlassView – A reusable component with a semi-transparent glass effect.
 * Encapsulates border, background, and rounding logic for the project's aesthetic.
 */

import type { ViewProps } from "react-native";
import { View } from "react-native";
import { cn } from "@/shared/utils/cn";

/**
 * Renders a View with a semi-transparent glass effect.
 *
 * @param props - Standard ViewProps including children, className, and style
 * @returns A View component with glass styling applied
 */
export const GlassView = ({
  children,
  className,
  style,
  ...props
}: ViewProps) => {
  return (
    <View
      {...props}
      style={style}
      className={cn("border border-white/40 bg-white/25", className)}
    >
      {children}
    </View>
  );
};
