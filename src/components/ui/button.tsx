import React from "react";
import { Pressable, type PressableProps, Text } from "react-native";
import { cn } from "@/shared/lib/cn";
import { cva, type VariantProps } from "@/shared/lib/cva";

const buttonVariants = cva(
  "group flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        outline: "border border-input bg-background",
        secondary: "bg-secondary",
        ghost: "",
        link: "",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const buttonTextVariants = cva("text-base font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
      link: "text-primary underline",
    },
    size: {
      default: "",
      sm: "text-sm",
      lg: "text-lg",
      icon: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  textClass?: string;
  children: React.ReactNode;
}

const Button = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ className, variant, size, textClass, children, ...props }, ref) => {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    >
      <Text className={cn(buttonTextVariants({ variant, size }), textClass)}>
        {children}
      </Text>
    </Pressable>
  );
});

Button.displayName = "Button";

export { Button, buttonVariants, buttonTextVariants };
