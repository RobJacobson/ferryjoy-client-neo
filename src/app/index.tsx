import { Link, type RelativePathString, router, Stack } from "expo-router";

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

        <View variant="card" className="w-full max-w-sm">
          <Text variant="heading3" className="mb-2">
            Component Examples
          </Text>
          <Text variant="body2" className="mb-4">
            Below are examples of the Button component with different variants
          </Text>

          <View className="flex flex-col gap-2">
            <Button variant="default">Default Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="destructive">Destructive Button</Button>
          </View>
        </View>

        <Link href={{ pathname: "/details", params: { name: "Dan" } }} asChild>
          <Button variant="default" className="mt-4">
            Show Details
          </Button>
        </Link>

        <Link href="/map" asChild>
          <Button variant="outline" className="mt-2">
            View Map
          </Button>
        </Link>

        <Link href={"/vessels" as RelativePathString} asChild>
          <Button variant="outline" className="mt-2">
            Vessel Locations
          </Button>
        </Link>

        <Link href={"/vessels-verbose" as RelativePathString} asChild>
          <Button variant="outline" className="mt-2">
            Vessels Verbose
          </Button>
        </Link>

        <Link href={"/terminals" as RelativePathString} asChild>
          <Button variant="outline" className="mt-2">
            Terminal Information
          </Button>
        </Link>
      </View>
    </View>
  );
}
