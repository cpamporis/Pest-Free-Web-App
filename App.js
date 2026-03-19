import "react-native-gesture-handler";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";
import { en, registerTranslation } from "react-native-paper-dates";
import RootApp from "./src/RootApp";
import ErrorBoundary from "./src/components/ErrorBoundary";

registerTranslation("en", en);

export default function App() {

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