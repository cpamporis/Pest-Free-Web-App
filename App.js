import "react-native-gesture-handler";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";
import { en, registerTranslation } from "react-native-paper-dates";
import { useFonts } from "expo-font";

import {
  MaterialIcons,
  FontAwesome5,
  MaterialCommunityIcons,
  Feather,
  Entypo,
} from "@expo/vector-icons";

import RootApp from "./src/RootApp";
import ErrorBoundary from "./src/components/ErrorBoundary";

registerTranslation("en", en);

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialIcons.font,
    ...FontAwesome5.font,
    ...MaterialCommunityIcons.font,
    ...Feather.font,
    ...Entypo.font,
  });

  // ⛔ IMPORTANT: wait for fonts
  if (!fontsLoaded) {
    return null;
  }

  return (
    <PaperProvider theme={MD3LightTheme}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ErrorBoundary>
            <RootApp />
          </ErrorBoundary>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </PaperProvider>
  );
}