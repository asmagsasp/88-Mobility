import React, { useState } from 'react';
import { StatusBar, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { EarningsScreen } from './src/screens/EarningsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { Colors } from './src/constants/theme';

const queryClient = new QueryClient();

type Tab = 'home' | 'earnings' | 'profile';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home',     icon: '🗺️',  label: 'Início'  },
  { id: 'earnings', icon: '💰',  label: 'Ganhos'  },
  { id: 'profile',  icon: '👤',  label: 'Perfil'  },
];

function TabBar({ active, onPress }: { active: Tab; onPress: (t: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tabItem}
          onPress={() => onPress(tab.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, active === tab.id && styles.tabLabelActive]}>
            {tab.label}
          </Text>
          {active === tab.id && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>('home');

  // Não autenticado → tela de login
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => {}} />;
  }

  // Autenticado → navegação por abas
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>
        {tab === 'home'     && <HomeScreen />}
        {tab === 'earnings' && <EarningsScreen />}
        {tab === 'profile'  && <ProfileScreen />}
      </View>
      <TabBar active={tab} onPress={setTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.darkCard,
    borderTopWidth: 1,
    borderTopColor: Colors.darkBorder,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabItem:      { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  tabIcon:      { fontSize: 22 },
  tabLabel:     { fontSize: 11, color: Colors.slate500, marginTop: 2 },
  tabLabelActive: { color: Colors.amber, fontWeight: '600' },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    width: 24, height: 2,
    borderRadius: 1,
    backgroundColor: Colors.amber,
  },
});
