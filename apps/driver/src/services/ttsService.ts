// Serviço de Síntese de Voz (TTS) em Português Brasileiro (pt-BR)
// Utiliza expo-speech para orientar o motorista com os nomes das ruas e curvas em tempo real

import * as Speech from 'expo-speech';

class TTSService {
  private enabled: boolean = true;
  private lastSpokenText: string = '';
  private isSpeaking: boolean = false;

  constructor() {
    this.enabled = true;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  public isVoiceEnabled(): boolean {
    return this.enabled;
  }

  public toggleVoice(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stop();
    }
    return this.enabled;
  }

  /**
   * Fala a instrução em português com cadência limpa e clara para navegação veicular
   */
  public async speak(text: string, force: boolean = false): Promise<void> {
    if (!this.enabled && !force) return;
    if (!text || text.trim() === '') return;

    // Se já falou essa mesma instrução recentemente, ignora a menos que seja forçado
    if (this.lastSpokenText === text && !force) return;

    this.lastSpokenText = text;

    try {
      await Speech.stop();
      Speech.speak(text, {
        language: 'pt-BR',
        pitch: 1.05,
        rate: 0.95, // velocidade perfeita para condução automotiva
        onStart: () => {
          this.isSpeaking = true;
        },
        onDone: () => {
          this.isSpeaking = false;
        },
        onError: (e) => {
          console.warn('[TTS] Erro de fala:', e);
          this.isSpeaking = false;
        },
      });
    } catch (err) {
      console.warn('[TTS] Exceção no expo-speech:', err);
    }
  }

  public stop(): void {
    try {
      Speech.stop();
    } catch {
      // Ignora erro ao parar
    }
    this.isSpeaking = false;
  }

  /**
   * Repete a última instrução falada
   */
  public repeat(): void {
    if (this.lastSpokenText) {
      this.speak(this.lastSpokenText, true);
    }
  }
}

export const ttsService = new TTSService();
