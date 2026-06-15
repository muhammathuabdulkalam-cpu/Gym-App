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
            case 'Home':     iconName = focused ? 'home' : 'home-outline'; break;
            case 'Weight':   iconName = 'scale-bathroom'; break;
            case 'Food':     iconName = 'silverware-fork-knife'; break;
            case 'Workouts': iconName = 'dumbbell'; break;
            case 'Profile':  iconName = focused ? 'account' : 'account-outline'; break;
            default:         iconName = 'circle';
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
      <Tab.Screen name="Home"     component={DashboardScreen} />
      <Tab.Screen name="Weight"   component={WeightScreen} />
      <Tab.Screen name="Food"     component={FoodScreen} />
      <Tab.Screen name="Workouts" component={WorkoutsScreen} />
      <Tab.Screen name="Profile"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const [isSplashActive, setIsSplashActive] = React.useState(true);
  const prefetchStarted = React.useRef(false);

  // ── Start data prefetch the moment we have an authenticated user ──────────
  React.useEffect(() => {
    if (user && !loading && !prefetchStarted.current) {
      prefetchStarted.current = true;
      // Fire-and-forget: fetch dashboard data in background during splash
      prefetchDashboardData();
    }
  }, [user, loading]);

  // ── Splash timer: 2500ms total. Splash shows even while auth is loading ───
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashActive(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Show splash while it is active (includes the auth loading time) */}
        {isSplashActive ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : user ? (
          <>
            <Stack.Screen name="Main"       component={MainTabs} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
