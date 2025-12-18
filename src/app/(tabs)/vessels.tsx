import { OpacityBlurPage } from "@/features/BlurHeader";
import { VesselsTripList } from "@/features/VesselsTripList";

export default function VesselsScreen() {
  return (
    <OpacityBlurPage
      navBarHeight={56}
      overlayProps={{
        // Contacts-style: masked blur + tint that fades out toward content.
        progressive: true,
        fadeStart: 0.5,
        opacity: 0.8,
        blurAmount: 30,
      }}
    >
      {({ contentInsetTop }) => (
        <VesselsTripList contentInsetTop={contentInsetTop} />
      )}
    </OpacityBlurPage>
  );
}
