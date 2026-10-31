import { useState } from 'react';
import { Zap, ZapOff, Clock, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { usePeakHour } from '../../hooks/usePeakHour';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import type { PeakHourConfig } from '../../types';

// Nomes dos dias da semana
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Verifica se um slot de pico está ativo AGORA
function isSlotActiveNow(slot: { start: string; end: string }): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);
  return cur >= sh * 60 + sm && cur < eh * 60 + em;
}

/**
 * Seção completa de configuração de horários de pico na PricingPage.
 * Acréscimo fixo de R$ X por corrida durante os horários configurados.
 */
export function PeakHourSection() {
  const { peakConfig, peakStatus, isSaving, isToggling, savePeakConfig, togglePeak } =
    usePeakHour();

  // Estado local do formulário (editável)
  const [form, setForm] = useState<Omit<PeakHourConfig, 'id' | 'updatedAt' | 'updatedBy'>>({
    enabled: peakConfig.enabled,
    surgeAmount: peakConfig.surgeAmount,
    surgeType: 'per_ride',
    slots: peakConfig.slots,
    weekdays: peakConfig.weekdays,
  });
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync quando config carrega do servidor
  const syncForm = (cfg: typeof peakConfig) => {
    setForm({
      enabled: cfg.enabled,
      surgeAmount: cfg.surgeAmount,
      surgeType: 'per_ride',
      slots: cfg.slots,
      weekdays: cfg.weekdays,
    });
    setIsDirty(false);
  };

  // Atualiza campo do form e marca como sujo
  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setIsDirty(true);
  };

  // Adiciona novo slot de pico
  const addSlot = () => {
    update('slots', [...form.slots, { start: '12:00', end: '13:00' }]);
  };

  // Remove slot por índice
  const removeSlot = (idx: number) => {
    update('slots', form.slots.filter((_, i) => i !== idx));
  };

  // Atualiza horário de um slot
  const updateSlot = (idx: number, field: 'start' | 'end', value: string) => {
    const updated = form.slots.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s
    );
    update('slots', updated);
  };

  // Toggle dia da semana
  const toggleWeekday = (day: number) => {
    const days = form.weekdays.includes(day)
      ? form.weekdays.filter((d) => d !== day)
      : [...form.weekdays, day].sort();
    update('weekdays', days);
  };

  // Salva configuração
  const handleSave = async () => {
    await savePeakConfig(form);
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 3000);
  };

  // Toggle rápido (liga/desliga tudo sem salvar o resto)
  const handleToggle = async () => {
    const newEnabled = !peakConfig.enabled;
    await togglePeak(newEnabled);
    syncForm({ ...peakConfig, enabled: newEnabled });
  };

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Card noPadding>
      {/* Header da seção */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-brand-dark-border">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
              peakConfig.enabled
                ? 'bg-orange-500/20 text-orange-400'
                : 'bg-brand-dark-border text-slate-500'
            )}
          >
            {peakConfig.enabled ? <Zap size={20} /> : <ZapOff size={20} />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              Horário de Pico
              {peakStatus.isActive && (
                <span className="flex items-center gap-1 text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full inline-block" />
                  ATIVO AGORA
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-400">
              Acréscimo automático de{' '}
              <span className="text-orange-400 font-semibold">
                {formatBRL(peakConfig.surgeAmount)} por corrida
              </span>{' '}
              nos horários configurados
            </p>
          </div>
        </div>

        {/* Toggle liga/desliga */}
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={clsx(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none',
            'focus:ring-2 focus:ring-brand-amber focus:ring-offset-2 focus:ring-offset-brand-dark',
            peakConfig.enabled ? 'bg-orange-500' : 'bg-brand-dark-border',
            isToggling && 'opacity-50 cursor-not-allowed'
          )}
          title={peakConfig.enabled ? 'Desativar horário de pico' : 'Ativar horário de pico'}
        >
          <span
            className={clsx(
              'inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform',
              peakConfig.enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Status atual */}
        <div
          className={clsx(
            'rounded-xl p-4 border',
            peakStatus.isActive
              ? 'bg-orange-900/20 border-orange-700/50'
              : 'bg-brand-dark border-brand-dark-border'
          )}
        >
          {peakStatus.isActive ? (
            <div className="flex items-start gap-3">
              <Zap size={18} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-orange-300 font-medium text-sm">
                  Pico ativo — cobrando +{formatBRL(peakConfig.surgeAmount)} por corrida
                </p>
                <p className="text-orange-400/70 text-xs mt-0.5">
                  Faixa: {peakStatus.currentSlot?.start} – {peakStatus.currentSlot?.end}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Clock size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-slate-300 text-sm font-medium">
                  {peakConfig.enabled
                    ? peakStatus.nextSlot
                      ? `Próximo pico hoje: ${peakStatus.nextSlot.start} – ${peakStatus.nextSlot.end}`
                      : 'Sem mais faixas de pico hoje'
                    : 'Horário de pico desativado'}
                </p>
                <p className="text-slate-500 text-xs mt-0.5">
                  Preço normal em vigor
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Valor do acréscimo */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Acréscimo por corrida (R$)
          </label>
          <div className="flex items-center gap-3">
            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
              <input
                type="number"
                step="0.50"
                min="0.50"
                max="20.00"
                value={form.surgeAmount}
                onChange={(e) => update('surgeAmount', Number(e.target.value))}
                className="w-full bg-brand-dark border border-brand-dark-border text-white rounded-lg pl-10 pr-4 py-2.5
                           font-bold text-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <span className="text-slate-400 text-sm">por corrida • motorista recebe R$ {((form.surgeAmount || 0) * 0.88).toFixed(2)} (88%)</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Valor fixo adicionado ao total da corrida durante o pico. Mín: R$ 0,50 · Máx: R$ 20,00
          </p>
        </div>

        {/* Dias da semana */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Dias da semana
          </label>
          <div className="flex gap-2 flex-wrap">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                className={clsx(
                  'w-12 h-12 rounded-xl text-sm font-semibold transition-all border',
                  form.weekdays.includes(day)
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                    : 'bg-brand-dark text-slate-500 border-brand-dark-border hover:border-slate-500 hover:text-slate-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Faixas de horário */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-300">
              Faixas de horário
            </label>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={addSlot}
            >
              Adicionar faixa
            </Button>
          </div>

          <div className="space-y-3">
            {form.slots.map((slot, idx) => {
              const activeNow = peakConfig.enabled && isSlotActiveNow(slot);
              return (
                <div
                  key={idx}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                    activeNow
                      ? 'bg-orange-900/20 border-orange-700/40'
                      : 'bg-brand-dark border-brand-dark-border'
                  )}
                >
                  <Clock size={16} className={activeNow ? 'text-orange-400' : 'text-slate-400'} />

                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateSlot(idx, 'start', e.target.value)}
                      className="bg-brand-dark-card border border-brand-dark-border text-white rounded-lg px-3 py-2
                                 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <span className="text-slate-500 text-sm font-medium">até</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateSlot(idx, 'end', e.target.value)}
                      className="bg-brand-dark-card border border-brand-dark-border text-white rounded-lg px-3 py-2
                                 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  {activeNow && (
                    <span className="text-xs text-orange-400 font-medium whitespace-nowrap">
                      ● ativo agora
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    disabled={form.slots.length === 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/20
                               transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remover faixa"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aviso se desativado mas tem slots configurados */}
        {!peakConfig.enabled && form.slots.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-700/40 rounded-xl text-amber-400 text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>O horário de pico está <strong>desativado</strong>. Os horários configurados não estão sendo aplicados. Use o toggle acima para ativar.</span>
          </div>
        )}

        {/* Botão Salvar */}
        <div className="flex items-center gap-3 pt-2 border-t border-brand-dark-border">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
              <Check size={16} />
              Configuração salva!
            </span>
          )}
          <Button
            variant={isDirty ? 'primary' : 'secondary'}
            size="md"
            isLoading={isSaving}
            onClick={handleSave}
            disabled={!isDirty && !saved}
            className="ml-auto"
          >
            Salvar configuração de pico
          </Button>
        </div>
      </div>
    </Card>
  );
}
