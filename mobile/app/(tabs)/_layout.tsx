import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#22c55e' }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Beholdning', tabBarIcon: () => <Text style={{ fontSize: 20 }}>📦</Text> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'AI Kokk', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👨‍🍳</Text> }}
      />
    </Tabs>
  );
}
