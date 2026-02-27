/**
 * DemoCard – Sample card component for AnimatedListView demo.
 * Demonstrates a typical card UI with header, author info, and expandable content.
 */

import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Item } from "@/shared/utils/fakerData";
import { SPACING } from "./types";

type DemoCardProps = {
  item: Item;
};

/**
 * Renders a demo card with blurred background image, title, author info,
 * and optional expanded content.
 *
 * @param item - Card data including image, title, description, and author
 */
const DemoCard = ({ item }: DemoCardProps) => {
  return (
    <TouchableOpacity activeOpacity={0.9} className="w-full flex-1">
      <Image
        source={{ uri: item.image }}
        style={[StyleSheet.absoluteFillObject]}
        blurRadius={30}
      />

      <View style={{ padding: SPACING * 3 }} className="flex-1 gap-2">
        {/* Header - Always Visible */}
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text className="font-bold text-white text-xl shadow-sm">
              {item.title}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Image
                source={{ uri: item.author.avatar }}
                style={{ width: 24, height: 24, borderRadius: 12 }}
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

        {/* Expanded Content - Hidden for now but preserved in UI */}
        {false && (
          <View className="mt-2 flex-1 gap-2">
            <Image
              source={{ uri: item.image }}
              style={{
                width: "100%",
                aspectRatio: 16 / 9,
                borderRadius: 8,
              }}
            />
            <Text className="font-semibold text-base text-white/75 leading-relaxed shadow-sm">
              {item.description}
            </Text>
            <Text className="font-semibold text-sm text-white/60 italic shadow-sm">
              Additional details about {item.title}. This section appears when
              you tap the expand icon.
            </Text>
            <View className="mt-2 flex-row gap-2">
              <View className="rounded-full bg-white/20 px-4 py-2">
                <Text className="font-medium text-sm text-white">Action 1</Text>
              </View>
              <View className="rounded-full bg-white/20 px-4 py-2">
                <Text className="font-medium text-sm text-white">Action 2</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default DemoCard;
