// Definição das paletas de cores para temas Claro e Escuro

export const LightColors = {
  amber: '#F59E0B',
  amberLight: '#FCD34D',
  amberDark: '#D97706',

  background: '#F8FAFC',
  card: '#FFFFFF',
  cardSecondary: '#F1F5F9',
  border: '#E2E8F0',

  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',

  success: '#22C55E',
  successLight: '#DCFCE7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Status bar
  statusBar: 'dark-content' as 'dark-content' | 'light-content',
};

export const DarkColors = {
  amber: '#F59E0B',
  amberLight: '#FCD34D',
  amberDark: '#D97706',

  background: '#0B1120',
  card: '#1E293B',
  cardSecondary: '#0F172A',
  border: '#334155',

  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  white: '#FFFFFF',
  slate50: '#1E293B',
  slate100: '#0F172A',
  slate200: '#334155',
  slate400: '#64748B',
  slate500: '#94A3B8',
  slate700: '#CBD5E1',
  slate800: '#E2E8F0',
  slate900: '#F8FAFC',

  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.2)',
  danger: '#EF4444',
  dangerLight: 'rgba(239, 68, 68, 0.2)',
  warning: '#F59E0B',
  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.2)',

  // Status bar
  statusBar: 'light-content' as 'dark-content' | 'light-content',
};

// Padrão compatível
export const Colors = LightColors;

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
};
