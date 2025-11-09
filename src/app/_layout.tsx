import "../../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { WsDottieProvider } from "@/shared/contexts";

// Create a client
const queryClient = new QueryClient();

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <WsDottieProvider>
        <Stack />
      </WsDottieProvider>
    </QueryClientProvider>
  );
}
