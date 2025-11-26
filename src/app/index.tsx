import { Link, Stack } from "expo-router";

import { Button, Text, View } from "@/components/ui";

export default function Home() {
  return (
    <View className="flex-1 bg-background p-4">
      <Stack.Screen options={{ title: "Home" }} />
      <View className="flex-1 items-center justify-center gap-4">
        <Text variant="heading1" className="mb-4">
          React Native Reusables
        </Text>
        <Text variant="body1" color="muted" className="text-center mb-8">
          This is an example of using React Native Reusables components
        </Text>

        <Link href="/map" asChild>
          <Button variant="outline" className="mt-2">
            View Map
          </Button>
        </Link>

        <Link href="/waves" asChild>
          <Button variant="outline" className="mt-2">
            View Waves
          </Button>
        </Link>
        <Link href="/waves2" asChild>
          <Button variant="outline" className="mt-2">
            View Waves 2
          </Button>
        </Link>
      </View>
    </View>
  );
}
