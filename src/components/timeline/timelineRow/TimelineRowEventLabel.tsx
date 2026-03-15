/**
 * Left-column event label for timeline rows.
 */

import { Text, View } from "@/components/ui";
import type { TimelineRenderBoundary } from "../types";

type TimelineRowEventLabelProps = {
  label?: TimelineRenderBoundary;
};

/**
 * Renders preformatted title and label text for a timeline row boundary.
 *
 * @param label - The boundary containing display-ready title and label text
 * @returns The label view or a spacer when no display text is available
 */
export const TimelineRowEventLabel = ({
  label,
}: TimelineRowEventLabelProps) => {
  const titleShadowOffsets = [1, 2, 3, 4];

  if (!label?.label && !label?.title) {
    return <View className="flex-1 justify-start" />;
  }

  return (
    <View className="relative mt-[-6px] flex flex-1 flex-row">
      {label.title && (
        <View className="absolute -top-6 -left-3 -rotate-[9deg]">
          {titleShadowOffsets.map((pos) => (
            <View
              key={pos}
              className="absolute"
              style={{ top: pos, left: -pos, zIndex: 0 }}
            >
              <Text className="font-puffberry text-3xl text-purple-400/10">
                {label.title}
              </Text>
            </View>
          ))}
          <View className="relative" style={{ zIndex: 1 }}>
            <Text className="font-puffberry text-3xl text-purple-400">
              {label.title}
            </Text>
          </View>
        </View>
      )}
      <View className="mx-1 flex flex-1 flex-row justify-end">
        <Text className="font-bitcount-400 text-lg text-purple-800 leading-none">
          {label.label}
        </Text>
      </View>
    </View>
  );
};
