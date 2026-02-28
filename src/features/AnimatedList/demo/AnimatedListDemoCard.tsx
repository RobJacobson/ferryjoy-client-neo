/**
 * DemoCard – Sample card component for AnimatedList demo.
 * Demonstrates a typical card UI with header and author info.
 */

import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Item } from "@/shared/utils/fakerData";

type AnimatedListDemoCardProps = {
  item: Item;
};

/**
 * Renders a demo card with blurred background image, title, and author info.
 *
 * @param item - Card data including image, title, description, and author
 */
const AnimatedListDemoCard = ({ item }: AnimatedListDemoCardProps) => {
  return (
    <TouchableOpacity activeOpacity={0.9} className="w-full flex-1">
      <Image
        source={{ uri: item.image }}
        style={StyleSheet.absoluteFillObject}
        blurRadius={30}
      />

      <View className="flex-1 gap-1 p-2">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Text className="font-bold text-lg text-white shadow-sm">
              {item.title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1.5">
              <Image
                source={{ uri: item.author.avatar }}
                className="h-5 w-5 rounded-full"
              />
              <Text className="font-semibold text-white/75 text-xs shadow-sm">
                {item.author.name}
              </Text>
            </View>
          </View>

          <View className="rounded-full bg-white/20 p-1.5">
            <Text className="font-bold text-base text-white">▼</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default AnimatedListDemoCard;
