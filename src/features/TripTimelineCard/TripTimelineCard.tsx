import { View } from "@/components/ui";
import { TripTimelineGraphic } from "./TripTimelineGraphic";
import type { TripTimelineCardProps } from "./types";
import { useTripTimelineCardModel } from "./useTripTimelineCardModel";

export const TripTimelineCard = (props: TripTimelineCardProps) => {
  const model = useTripTimelineCardModel(props);

  return (
    <View
      className="px-4 pb-16 w-full"
      accessibilityLabel={model.accessibilityLabel}
    >
      <View className="h-[64px]">
        <TripTimelineGraphic
          trackWidth={model.trackWidth}
          onTrackLayout={model.onTrackLayout}
          isActive={model.isActive}
          direction={props.direction}
          departP={model.departP}
          progressP={model.progressP}
          progressX={model.progressX}
          startFilled={model.startFilled}
          departFilled={model.departFilled}
          endFilled={model.endFilled}
          calloutText={model.calloutText}
          startLabel={model.startLabel}
          departLabel={model.departLabel}
          endLabel={model.endLabel}
        />
      </View>
    </View>
  );
};
