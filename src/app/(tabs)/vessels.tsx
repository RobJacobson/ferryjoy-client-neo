import { BlurPage } from "@/features/BlurHeader";
import { VesselsTripList } from "@/features/VesselsTripList";

export default function VesselsScreen() {
  return (
    <BlurPage
      navBarHeight={56}
      overlayProps={{
        // iOS 26 Contacts-style: progressive blur + tint that fades out toward content.
        progressive: true,
        fadeStart: 0.5,
        opacity: 0.8,
        blurAmount: 2, // Reduced blur intensity at the top
        blurType: "xlight",
        blurStartOffset: 0.25,
      }}
    >
      {({ contentInsetTop }) => (
        <VesselsTripList contentInsetTop={contentInsetTop} />
      )}
    </BlurPage>
  );
}
