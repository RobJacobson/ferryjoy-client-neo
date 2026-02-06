/**
 * TripCard - shared card shell for vessel trip and scheduled trip displays.
 * Provides consistent Card > CardHeader (route) > CardContent (timeline) layout.
 */

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TripCardProps = {
  /** Route display (terminals + vessel name). */
  routeContent: ReactNode;
  /** Timeline or other main content. */
  children: ReactNode;
  /** Optional className for the Card. */
  cardClassName?: string;
  /** Optional className for the CardContent. */
  contentClassName?: string;
  /** Optional className for the CardHeader. */
  headerClassName?: string;
};

/**
 * Renders a card with route header and content area for trip timelines.
 *
 * @param routeContent - Route display (e.g. terminals + vessel name)
 * @param children - Timeline or main content
 * @param cardClassName - Optional Card styling
 * @param contentClassName - Optional CardContent styling
 * @param headerClassName - Optional CardHeader styling
 * @returns Card with header and content
 */
export const TripCard = ({
  routeContent,
  children,
  cardClassName,
  contentClassName,
  headerClassName,
}: TripCardProps) => (
  <Card className={cn("mb-6 gap-4", cardClassName)}>
    <CardHeader className={cn("z-10", headerClassName)}>
      {routeContent}
    </CardHeader>
    <CardContent className={cn("overflow-visible", contentClassName)}>
      {children}
    </CardContent>
  </Card>
);
