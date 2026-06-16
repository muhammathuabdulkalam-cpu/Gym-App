// src/navigation/RootNavigator.jsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { prefetchDashboardData } from '../utils/dataCache';

// Screens
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import WeightScreen from '../screens/WeightScreen';
import FoodScreen from '../screens/FoodScreen';
import WorkoutsScreen from '../screens/WorkoutsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home': iconName = focused ? 'home' : 'home-outline'; break;
            case 'Weight': iconName = 'scale-bathroom'; break;
            case 'Food': iconName = 'silverware-fork-knife'; break;
            case 'Workouts': iconName = 'dumbbell'; break;
            case 'Profile': iconName = focused ? 'account' : 'account-outline'; break;
            default: iconName = 'circle';
          }
          return <MaterialCommunityIcons name={iconName} size={size + 2} color={color} />;
        },
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
        tabBarStyle: {
          backgroundColor: '#0a0a0f',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.05)',
          paddingTop: 8,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          marginTop: -4,
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Weight" component={WeightScreen} />
      <Tab.Screen name="Food" component={FoodScreen} />
      <Tab.Screen name="Workouts" component={WorkoutsScreen} />
      <Tab.Screen name="Profile" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const [splashMode, setSplashMode] = React.useState('loading'); // 'loading', 'welcome', 'none'
  const prefetchStarted = React.useRef(false);
  const prevUserRef = React.useRef(null);

  // ── Start data prefetch the moment we have an authenticated user ──────────
  React.useEffect(() => {
    if (user && !loading && !prefetchStarted.current) {
      prefetchStarted.current = true;
      // Fire-and-forget: fetch dashboard data in background during splash
      prefetchDashboardData();
    }
  }, [user, loading]);

  // ── Manage splash state transitions ───────────────────────────────────────
  React.useEffect(() => {
    if (loading) {
      setSplashMode('loading');
      return;
    }

    const wasLoggedIn = !!prevUserRef.current;
    const isLoggedIn = !!user;

    if (isLoggedIn && !wasLoggedIn) {
      // Login/Signup event or first launch already logged in
      setSplashMode('welcome');
      const timer = setTimeout(() => {
        setSplashMode('none');
      }, 3200);

      prevUserRef.current = user;
      return () => clearTimeout(timer);
    } else if (!isLoggedIn) {
      // Logged out or launch without user
      setSplashMode('none');
      prevUserRef.current = null;
    } else {
      // Already logged in, no state change (e.g. settings profile update)
      prevUserRef.current = user;
    }
  }, [loading, user]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {splashMode === 'loading' ? (
          <Stack.Screen name="Splash">
            {() => <SplashScreen mode="loading" />}
          </Stack.Screen>
        ) : splashMode === 'welcome' ? (
          <Stack.Screen name="Splash">
            {() => <SplashScreen mode="welcome" />}
          </Stack.Screen>
        ) : user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
