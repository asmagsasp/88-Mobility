import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import type { RouteStep } from '../services/routeService';

interface NavigationBannerProps {
  currentStep: RouteStep | null;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onRepeatVoice: () => void;
  targetType: 'passenger' | 'destination';
  targetAddress: string;
}

export function NavigationBanner({
  currentStep,
  voiceEnabled,
  onToggleVoice,
  onRepeatVoice,
  targetType,
  targetAddress,
}: NavigationBannerProps) {
  if (!currentStep) return null;

  // Determina o ícone de manobra baseado no tipo e modificador
  const getManeuverIcon = () => {
    const type = currentStep.maneuverType;
    const mod = currentStep.maneuverModifier;

    if (type === 'arrive') return '🏁';
    if (type === 'roundabout' || type === 'rotary') return '🔄';
    if (mod.includes('uturn')) return '↩️';
    if (mod.includes('sharp right')) return '↪️';
    if (mod.includes('sharp left')) return '↩️';
    if (mod.includes('right')) return '↗️';
    if (mod.includes('left')) return '↖️';
    return '⬆️';
  };

  const formattedDistance = () => {
    const d = currentStep.distanceMeters;
    if (d >= 1000) {
      return `${(d / 1000).toFixed(1)} km`;
    }
    return `${Math.round(d)} m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.maneuverBox}>
          <Text style={styles.maneuverIcon}>{getManeuverIcon()}</Text>
          <Text style={styles.distanceText}>{formattedDistance()}</Text>
        </View>

        <View style={styles.instructionBox}>
          <Text style={styles.targetLabel}>
            {targetType === 'passenger' ? 'Indo buscar passageiro' : 'A caminho do destino'}
          </Text>
          <Text style={styles.streetName} numberOfLines={1}>
            {currentStep.streetName}
          </Text>
          <Text style={styles.instructionText} numberOfLines={1}>
            {currentStep.instruction}
          </Text>
        </View>

        <View style={styles.controlsCol}>
          <TouchableOpacity
            style={[styles.controlBtn, voiceEnabled ? styles.btnActive : styles.btnMuted]}
            onPress={onToggleVoice}
            activeOpacity={0.7}
          >
            <Text style={styles.controlIcon}>{voiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.repeatBtn}
            onPress={onRepeatVoice}
            activeOpacity={0.7}
          >
            <Text style={styles.repeatIcon}>🗣️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    left: 14,
    right: 14,
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 999,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  maneuverBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  maneuverIcon: {
    fontSize: 26,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    marginTop: 2,
  },
  instructionBox: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streetName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  instructionText: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  controlsCol: {
    flexDirection: 'column',
    gap: 6,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  btnMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  controlIcon: {
    fontSize: 18,
  },
  repeatBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  repeatIcon: {
    fontSize: 16,
  },
});
