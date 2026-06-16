import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    // We use a custom JS splash screen (SplashScreen.jsx), 
    // so hide the native one immediately after JS loads
    setTimeout(() => {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }, 100);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
