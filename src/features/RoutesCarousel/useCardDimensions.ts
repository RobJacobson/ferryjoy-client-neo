import { useSafeAreaDimensions } from "@/shared/hooks";

const SPACING = 12;
const VIEWPORT_FRACTION = 0.9;

type Layout = {
  direction: "horizontal";
  itemSize: number;
  spacing: number;
};

type CardDimensions = {
  cardWidth: number;
  cardHeight: number;
  layout: Layout;
};

/**
 * Calculates card dimensions and carousel layout based on safe area constraints.
 *
 * Ensures cards fit within 90% of the safe area while maintaining a 1:2 aspect ratio.
 * The width is calculated based on both width and height constraints, using the smaller
 * value to guarantee the card fits in either dimension.
 *
 * @returns Object containing calculated dimensions and layout configuration:
 *   - `cardWidth` - Calculated width of each card
 *   - `cardHeight` - Calculated height (2x width for 1:2 aspect ratio)
 *   - `layout` - AnimatedList layout configuration
 *
 * @example
 * ```tsx
 * const { cardWidth, cardHeight, layout } = useCardDimensions();
 * ```
 */
const useCardDimensions = (): CardDimensions => {
  const { safeAreaWidth, safeAreaHeight } = useSafeAreaDimensions();

  // Calculate width based on both safe area constraints and use the smaller one
  // CARD_ASPECT_RATIO = 1/2 means width:height = 1:2, so height = 2 * width
  const widthBasedOnWidth = safeAreaWidth * VIEWPORT_FRACTION;
  const widthBasedOnHeight = (safeAreaHeight * VIEWPORT_FRACTION) / 2;

  const cardWidth = Math.min(widthBasedOnWidth, widthBasedOnHeight);
  const cardHeight = cardWidth * 2;

  const layout: Layout = {
    direction: "horizontal",
    itemSize: cardWidth,
    spacing: SPACING,
  };

  return { cardWidth, cardHeight, layout };
};

export { useCardDimensions };
