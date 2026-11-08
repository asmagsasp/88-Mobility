import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Spacing, Radius } from '../constants/theme';

interface RatingModalProps {
  visible: boolean;
  rideId: string;
  driverName: string;
  onSubmit: (rating: number, comment: string, tags: string[]) => void;
  onClose: () => void;
}

const RATING_TAGS = [
  '🚗 Carro limpo',
  '⭐ Direção segura',
  '⏱️ Pontualidade',
  '💬 Educado e gentil',
  '❄️ Ar-condicionado ótimo',
  '🎶 Música agradável',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Muito ruim 😞',
  2: 'Poderia melhorar 😐',
  3: 'Regular 🙂',
  4: 'Muito bom! 😊',
  5: 'Excelente experiência! 🌟',
};

export function RatingModal({
  visible,
  rideId,
  driverName,
  onSubmit,
  onClose,
}: RatingModalProps) {
  const { colors, isDark } = useTheme();
  const [stars, setStars] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    onSubmit(stars, comment.trim(), selectedTags);
    // Reset state
    setStars(5);
    setSelectedTags([]);
    setComment('');
  };

  const handleSkip = () => {
    onClose();
    setStars(5);
    setSelectedTags([]);
    setComment('');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Ícone de troféu/estrela */}
            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#1E293B' : '#FEF3C7' }]}>
              <Text style={styles.iconCircleText}>⭐</Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>Avalie sua Viagem</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Como foi sua experiência com{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {driverName || 'o motorista'}
              </Text>
              ?
            </Text>

            {/* Estrelas interativas */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((val) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => setStars(val)}
                  activeOpacity={0.7}
                  style={styles.starTouch}
                >
                  <Text
                    style={[
                      styles.starIcon,
                      { color: val <= stars ? '#F59E0B' : (isDark ? '#475569' : '#CBD5E1') },
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.ratingLabel, { color: '#F59E0B' }]}>
              {RATING_LABELS[stars]}
            </Text>

            {/* Tags rápidas */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              O que você mais gostou?
            </Text>
            <View style={styles.tagsContainer}>
              {RATING_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagBadge,
                      {
                        backgroundColor: isSelected
                          ? '#F59E0B'
                          : isDark
                          ? '#0F172A'
                          : '#F1F5F9',
                        borderColor: isSelected
                          ? '#F59E0B'
                          : isDark
                          ? '#334155'
                          : '#E2E8F0',
                      },
                    ]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        {
                          color: isSelected
                            ? '#0F172A'
                            : isDark
                            ? '#E2E8F0'
                            : '#334155',
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Campo opcional de comentário */}
            <TextInput
              style={[
                styles.commentInput,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  color: colors.text,
                },
              ]}
              placeholder="Escreva um comentário (opcional)..."
              placeholderTextColor={colors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              maxLength={250}
            />

            {/* Botões de Ação */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>Enviar Avaliação ⭐</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>
                Pular por enquanto
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  iconCircleText: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: Spacing.xs,
  },
  starTouch: {
    padding: 4,
  },
  starIcon: {
    fontSize: 38,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.md,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    marginBottom: Spacing.md,
  },
  tagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
  },
  commentInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    marginTop: Spacing.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
