import { View } from "@/components/ui";
import { TripTimelineGraphic } from "./TripTimelineGraphic";
import type { TripTimelineCardProps } from "./types";
import { useTripTimelineCardModel } from "./useTripTimelineCardModel";

export const TripTimelineCard = (props: TripTimelineCardProps) => {
  const model = useTripTimelineCardModel(props);

  return (
    <View
      className="px-4 py-2 w-full"
      accessibilityLabel={model.accessibilityLabel}
    >
      <View className="h-[64px]">
        <TripTimelineGraphic
          isActive={model.isActive}
          status={props.status}
          departP={model.departP}
          progressP={model.progressP}
          startFilled={model.startFilled}
          departFilled={model.departFilled}
          endFilled={model.endFilled}
          startTime={props.startTime}
          departTime={props.departTime}
          endTime={props.endTime}
          VesselName={props.VesselName}
          VesselStatus={props.VesselStatus}
        />
      </View>
    </View>
  );
};
