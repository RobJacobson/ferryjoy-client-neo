/**
 * DemoCard – Sample card component for AnimatedList demo.
 * Demonstrates a typical card UI with header and author info.
 */

import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Text, TouchableOpacity, View } from "react-native";
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

      <View className="flex-1 gap-2 p-3">
        {/* Header - Always Visible */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="font-bold text-white text-xl shadow-sm">
              {item.title}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Image
                source={{ uri: item.author.avatar }}
                className="h-6 w-6 rounded-full"
              />
              <Text className="font-semibold text-sm text-white/75 shadow-sm">
                {item.author.name}
              </Text>
            </View>
          </View>

          {/* Expand/Collapse Icon - Static (non-functional) */}
          <View className="rounded-full bg-white/20 p-2">
            <Text className="font-bold text-white text-xl">▼</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default AnimatedListDemoCard;
