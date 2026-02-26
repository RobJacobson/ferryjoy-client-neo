import type { Item } from "@/shared/utils/fakerData";

export type AnimatedListItem = Item & { key: string };

export const SPACING = 4;
export const CARD_HEIGHT_RATIO = 0.3; // 30% of screen height for fixed-size cards
export const ACTIVE_CARD_POSITION_RATIO = 0.5; // 0.0 = top, 0.5 = center, 1.0 = bottom
