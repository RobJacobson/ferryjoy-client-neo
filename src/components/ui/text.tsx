import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/shared/utils/cn";
import { cva, type VariantProps } from "@/shared/utils/cva";

const textVariants = cva("text-foreground", {
  variants: {
    variant: {
      default: "",
      heading1: "text-4xl font-bold",
      heading2: "text-3xl font-bold",
      heading3: "text-2xl font-bold",
      heading4: "text-xl font-bold",
      heading5: "text-lg font-bold",
      heading6: "text-base font-bold",
      body1: "text-base",
      body2: "text-sm",
      caption: "text-xs",
      label: "text-sm font-medium",
      muted: "text-muted-foreground",
    },
    color: {
      default: "text-foreground",
      primary: "text-primary",
      secondary: "text-secondary",
      destructive: "text-destructive",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
    color: "default",
  },
});

interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {}

const Text = React.forwardRef<React.ElementRef<typeof RNText>, TextProps>(
  ({ className, variant, color, ...props }, ref) => {
    return (
      <RNText
        className={cn(textVariants({ variant, color }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Text.displayName = "Text";

export { Text, textVariants };
