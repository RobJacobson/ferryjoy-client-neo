import { GlassHeader } from "@/features/GlassHeader";
import { VesselsTripList } from "@/features/VesselsTripList";

export default function VesselsScreen() {
  return (
    <GlassHeader
      navBarHeight={56}
      tintColor="rgba(255, 255, 255, 0)"
      glassEffectStyle="regular"
      enableProgressiveBlur={true}
      blurIntensity={5}
    >
      {({ contentInsetTop }) => (
        <VesselsTripList contentInsetTop={contentInsetTop} />
      )}
    </GlassHeader>
  );
}
