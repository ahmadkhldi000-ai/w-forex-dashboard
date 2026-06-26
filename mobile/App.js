// W Forex App — Root: bottom-tab navigation (English UI).
// Screens live in ./src/screens (Home, Telegram, About) and consume ./src/api + ./src/config.
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './src/screens/HomeScreen';
import TelegramScreen from './src/screens/TelegramScreen';
import AboutScreen from './src/screens/AboutScreen';
import { COLORS } from './src/config';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: COLORS.gold,
          tabBarInactiveTintColor: COLORS.muted,
          tabBarStyle: {
            backgroundColor: COLORS.bg,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 58,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarIcon: ({ color, size }) => {
            let name;
            if (route.name === 'Home') name = 'trending-up';
            else if (route.name === 'Telegram') name = 'send';
            else if (route.name === 'About') name = 'information-circle';
            return <Ionicons name={name} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: 'Dashboard' }}
        />
        <Tab.Screen
          name="Telegram"
          component={TelegramScreen}
          options={{ tabBarLabel: 'Telegram' }}
        />
        <Tab.Screen
          name="About"
          component={AboutScreen}
          options={{ tabBarLabel: 'About' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
