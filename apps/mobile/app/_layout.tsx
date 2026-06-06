import { Stack } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function Layout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#f7f6f1" }
      }}
    />
  );
}
