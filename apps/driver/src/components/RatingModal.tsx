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
import { Colors, Spacing, Radius } from '../constants/theme';

interface DriverRatingModalProps {
  visible: boolean;
  rideId: string;
  passengerName: string;
  onSubmit: (rating: number, comment: string, tags: string[]) => void;
  onClose: () => void;
}

const DRIVER_TAGS = [
  '🤝 Passageiro educado',
  '⏱️ Pontual no embarque',
  '⭐ Viagem tranquila',
  '💬 Comunicação clara',
  '📍 Ponto de embarque exato',
  '🧼 Respeitou o veículo',
];

const RATING_LABELS: Record<number, string> = {
  1: 'Comportamento inadequado 😞',
  2: 'Dificuldades no trajeto 😐',
  3: 'Regular 🙂',
  4: 'Muito bom passageiro! 😊',
  5: 'Passageiro nota 10! 🌟',
};

export function RatingModal({
  visible,
  rideId,
  passengerName,
  onSubmit,
  onClose,
}: DriverRatingModalProps) {
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
        <View style={styles.card}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Ícone */}
            <View style={styles.iconCircle}>
              <Text style={styles.iconCircleText}>⭐</Text>
            </View>

            <Text style={styles.title}>Avaliar Passageiro</Text>
            <Text style={styles.subtitle}>
              Como foi sua corrida com{' '}
              <Text style={{ fontWeight: '700', color: Colors.white }}>
                {passengerName || 'o passageiro'}
              </Text>
              ?
            </Text>

            {/* Estrelas */}
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
                      { color: val <= stars ? '#F59E0B' : Colors.slate600 },
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.ratingLabel}>{RATING_LABELS[stars]}</Text>

            {/* Tags rápidas */}
            <Text style={styles.sectionTitle}>Como foi o passageiro?</Text>
            <View style={styles.tagsContainer}>
              {DRIVER_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagBadge,
                      isSelected && styles.tagBadgeSelected,
                    ]}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        isSelected && styles.tagTextSelected,
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
              style={styles.commentInput}
              placeholder="Observações sobre o passageiro (opcional)..."
              placeholderTextColor={Colors.slate400}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              maxLength={250}
            />

            {/* Botão Enviar */}
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
              <Text style={styles.skipBtnText}>Pular por enquanto</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.darkCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.45,
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
    backgroundColor: '#1E293B',
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
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.slate400,
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
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: Spacing.md,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.slate400,
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
    borderColor: Colors.darkBorder,
    backgroundColor: Colors.dark,
  },
  tagBadgeSelected: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  tagText: {
    fontSize: 13,
    color: Colors.slate200,
  },
  tagTextSelected: {
    color: Colors.dark,
    fontWeight: '700',
  },
  commentInput: {
    width: '100%',
    backgroundColor: Colors.dark,
    borderWidth: 1,
    borderColor: Colors.darkBorder,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: 14,
    color: Colors.white,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: Colors.amber,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    shadowColor: Colors.amber,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: {
    color: Colors.dark,
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
    color: Colors.slate400,
    fontWeight: '600',
  },
});
