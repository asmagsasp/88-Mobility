import React, { useState } from 'react';
import { StatusBar, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const queryClient = new QueryClient();

type Tab = 'home' | 'history' | 'profile';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home',    icon: '🗺️', label: 'Início'   },
  { id: 'history', icon: '🕐', label: 'Corridas' },
  { id: 'profile', icon: '👤', label: 'Perfil'   },
];

function TabBar({ active, onPress }: { active: Tab; onPress: (t: Tab) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map(tab => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tabItem}
          onPress={() => onPress(tab.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[styles.tabLabel, { color: colors.textSecondary }, active === tab.id && { color: colors.amber, fontWeight: '700' }]}>
            {tab.label}
          </Text>
          {active === tab.id && <View style={[styles.tabIndicator, { backgroundColor: colors.amber }]} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AppNavigator() {
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const [tab, setTab] = useState<Tab>('home');

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LoginScreen onLogin={() => {}} />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1 }}>
        {tab === 'home'    && <HomeScreen />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </View>
      <TabBar active={tab} onPress={setTab} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tabItem:       { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  tabIcon:       { fontSize: 22 },
  tabLabel:      { fontSize: 11, marginTop: 2 },
  tabIndicator:  {
    position: 'absolute', top: 0,
    width: 24, height: 2, borderRadius: 1,
  },
});
