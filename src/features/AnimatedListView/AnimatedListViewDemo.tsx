/**
 * AnimatedListViewDemo – Demo component showcasing the generic AnimatedListView.
 * Demonstrates rendering the same card content as the original implementation
 * using the new renderItem callback pattern.
 */

import data from "@/shared/utils/fakerData";
import { useAvailableDimensions } from "@/shared/utils/useAvailableDimensions";
import AnimatedListView from "./AnimatedListView";
import DemoCard from "./DemoCard";
import { CARD_HEIGHT_RATIO, SPACING } from "./types";

const AnimatedListViewDemo = () => {
  const { availableHeight: totalHeight } = useAvailableDimensions();

  // Fixed card height
  const cardHeight = Math.floor(totalHeight * CARD_HEIGHT_RATIO);

  return (
    <AnimatedListView
      data={data}
      renderItem={(item) => <DemoCard item={item} />}
      layout={{
        itemSize: cardHeight,
        spacing: SPACING,
        activePositionRatio: 0.5,
      }}
    />
  );
};

export default AnimatedListViewDemo;
