import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";
import { registerRootStoreCleanup } from "@/store/useSessionStore";
import HomeScreen from "@/screens/HomeScreen";

export default function App() {
  useEffect(() => {
    return () => {
      registerRootStoreCleanup();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
