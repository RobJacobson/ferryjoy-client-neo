/**
 * RoutesCarousel – ScrollView-based carousel of Pexels photos.
 * Parallax background (BlurTargetView + Background) is rendered behind in index.tsx.
 */

import { Image } from "expo-image";
import { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  type Photo as PexelsPhoto,
  usePexelsData,
} from "@/shared/hooks/usePexelsData";

const SPACING = 12;
const CARD_RADIUS = 16;
const PORTRAIT_ASPECT_RATIO = 9 / 16;

type RoutesCarouselProps = {
  /** Shared scroll offset (x) in pixels; updated by useScrollOffset for Background parallax. */
  scrollX: SharedValue<number>;
  /** Called when slot width (snap interval) is computed; used for Background parallax. */
  onSlotWidthChange: (slotWidth: number) => void;
};

const RoutesCarousel = ({
  scrollX,
  onSlotWidthChange,
}: RoutesCarouselProps) => {
  const { data, isLoading } = usePexelsData();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Largest 9:16 rect that fits in 90% of viewport (width and height)
  const maxW = windowWidth * 0.9;
  const maxH = windowHeight * 0.9;
  const widthBinds = maxW * (16 / 9) <= maxH;
  const imageWidth = widthBinds ? maxW : maxH * PORTRAIT_ASPECT_RATIO;
  const imageHeight = widthBinds ? maxW * (16 / 9) : maxH;

  const snapInterval = imageWidth + SPACING;
  const photos = data?.photos ?? [];
  const sidePadding = Math.max(0, (windowWidth - imageWidth) / 2);

  const animatedRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(animatedRef, scrollX);
  const scrollXNormalized = useDerivedValue(
    () => scrollX.value / snapInterval,
    [snapInterval],
  );

  useEffect(() => {
    onSlotWidthChange(snapInterval);
  }, [snapInterval, onSlotWidthChange]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }
  return (
    <View className="relative flex-1 items-center justify-center">
      <Animated.ScrollView
        ref={animatedRef}
        horizontal
        contentContainerStyle={{
          gap: SPACING,
          paddingHorizontal: sidePadding,
          paddingTop: 24 + insets.top,
          paddingBottom: 24 + insets.bottom,
        }}
        style={[
          { width: "100%", flexGrow: 0 },
          { scrollSnapType: "x mandatory" } as ViewStyle,
        ]}
        scrollEventThrottle={16}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
      >
        {photos.map((photo, index) => (
          <Photo
            key={photo.id}
            item={photo}
            index={index}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            scrollX={scrollXNormalized}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
};

const Photo = ({
  item,
  index,
  imageWidth,
  imageHeight,
  scrollX,
}: {
  item: PexelsPhoto;
  index: number;
  imageWidth: number;
  imageHeight: number;
  scrollX: SharedValue<number>;
}) => {
  const zIndexStyle = useAnimatedStyle(() => ({
    zIndex: Math.round(
      interpolate(
        scrollX.value,
        [index - 1, index, index + 1],
        [0, 10, 0],
        Extrapolation.CLAMP,
      ),
    ),
  }));
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [index - 1.1, index, index + 1.1],
      [0.0, 1, 0.0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          scrollX.value,
          [index - 1, index, index + 1],
          [0.9, 1, 0.9],
          Extrapolation.CLAMP,
        ),
      },
      {
        rotate: `${interpolate(
          scrollX.value,
          [index - 1, index, index + 1],
          [15, 0, -15],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));
  return (
    <Animated.View
      className="relative"
      style={[
        { width: imageWidth, height: imageHeight },
        { scrollSnapAlign: "center", overflow: "visible" } as ViewStyle,
        zIndexStyle,
        animatedStyle,
      ]}
    >
      <Image
        source={{ uri: item.src.large }}
        style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]}
        contentFit="cover"
      />
    </Animated.View>
  );
};

export default RoutesCarousel;
