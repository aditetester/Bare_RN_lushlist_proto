import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import DownloadsScreen from '../screens/DownloadsScreen';
import WebViewScreen from '../screens/WebViewScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
        },
        tabBarActiveTintColor: '#ff4081',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen
        name="Downloads"
        component={DownloadsScreen}
        options={{
          tabBarLabel: 'Downloads',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>↓</Text>
          ),
        }}
      />
      {/* Add more tabs here later */}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1a1a' },
      }}
    >
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen
        name="WebView"
        component={WebViewScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}
