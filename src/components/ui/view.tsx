import React from "react";
import { View as RNView, type ViewProps as RNViewProps } from "react-native";
import { cn } from "@/shared/lib/cn";
import { cva, type VariantProps } from "@/shared/lib/cva";

const viewVariants = cva("", {
  variants: {
    variant: {
      default: "",
      card: "rounded-lg border border-border bg-card p-4 shadow-sm",
      outlined: "border border-border rounded-md",
      elevated: "shadow-md",
    },
    bg: {
      default: "",
      primary: "bg-primary",
      secondary: "bg-secondary",
      background: "bg-background",
      card: "bg-card",
      muted: "bg-muted",
      destructive: "bg-destructive",
    },
    padding: {
      none: "",
      sm: "p-2",
      default: "p-4",
      lg: "p-6",
      xl: "p-8",
    },
    margin: {
      none: "",
      sm: "m-2",
      default: "m-4",
      lg: "m-6",
      xl: "m-8",
    },
    flex: {
      none: "",
      row: "flex flex-row",
      col: "flex flex-col",
      "row-reverse": "flex flex-row-reverse",
      "col-reverse": "flex flex-col-reverse",
    },
    items: {
      none: "",
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    },
    justify: {
      none: "",
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    },
  },
  defaultVariants: {
    variant: "default",
    bg: "default",
    padding: "none",
    margin: "none",
    flex: "none",
    items: "none",
    justify: "none",
  },
});

interface ViewProps extends RNViewProps, VariantProps<typeof viewVariants> {}

const View = React.forwardRef<React.ElementRef<typeof RNView>, ViewProps>(
  (
    { className, variant, bg, padding, margin, flex, items, justify, ...props },
    ref,
  ) => {
    return (
      <RNView
        className={cn(
          viewVariants({ variant, bg, padding, margin, flex, items, justify }),
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

View.displayName = "View";

export { View, viewVariants };
