// Serviço de sincronização em tempo real entre Passageiro e Motorista
// Integração dupla: Banco SQLite no Backend (VPS) + Ponte de eventos em tempo real (ntfy.sh)

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://143.95.189.218/api';
const SYNC_URL = 'https://ntfy.sh/88mobility_live_rides_sync';

export interface SyncRidePayload {
  id: string;
  passengerName: string;
  origin: {
    latitude: number;
    longitude: number;
    address: string;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  distanceKm: number;
  totalAmount: number;
  driverShare: number;
  platformFee: number;
  status: 'requested' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  requestedAt: string;
  estimatedMinutes: number;
}

export type RideSyncEvent =
  | { type: 'REQUEST_RIDE'; ride: SyncRidePayload }
  | { type: 'ACCEPT_RIDE'; rideId: string; driver: { name: string; vehicle: string; plate: string; phone: string; rating: number; latitude?: number; longitude?: number } }
  | { type: 'DRIVER_LOCATION'; rideId?: string; latitude: number; longitude: number; heading: number; driverId?: string; driverName?: string; vehicle?: string }
  | { type: 'ARRIVED_PASSENGER'; rideId: string }
  | { type: 'START_TRIP'; rideId: string }
  | { type: 'DECLINE_RIDE'; rideId: string }
  | { type: 'COMPLETE_RIDE'; rideId: string }
  | { type: 'CANCEL_RIDE'; rideId: string }
  | { type: 'PAYMENT_CONFIRMED'; rideId: string; status: string; captureMethod?: string; totalAmount?: number; driverAmount?: number; payout?: any; timestamp?: string }
  | { type: 'DRIVER_PAYOUT_RECEIVED'; rideId: string; driverId: string; amount: number; pixKey: string; transactionId?: string; message?: string; timestamp?: string }
  | { type: 'DRIVER_STATUS'; driverId: string; isOnline: boolean; latitude?: number; longitude?: number; vehicle?: string; plate?: string; name?: string }
  | { type: 'CHAT_MESSAGE'; rideId: string; message: { id: string; rideId: string; senderId: string; senderRole: string; content: string; createdAt: string } }
  | { type: 'CHAT_TYPING'; rideId: string; userId: string; isTyping: boolean };

/** Cache de IDs já processados para evitar duplicações */
const seenEventIds = new Set<string>();
let isInitialized = false;

/**
 * Publica um evento no canal em tempo real e persiste no SQLite do Backend (VPS)
 */
export async function publishRideEvent(event: RideSyncEvent): Promise<boolean> {
  const rideId = 'ride' in event ? event.ride.id : ('rideId' in event ? event.rideId : 'global');

  // 1. Persiste no banco de dados SQLite do Backend (VPS)
  try {
    fetch(`${BACKEND_URL}/rides/sync/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, type: event.type, payload: event }),
    }).catch(() => {});
  } catch {}

  // 2. Transmite via canal em tempo real (ntfy.sh)
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': event.type,
      },
      body: JSON.stringify(event),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Sync] Erro ao publicar evento:', err);
    return false;
  }
}

/**
 * Consulta eventos recentes no canal de forma contínua e deduplicada
 */
export async function pollRideEvents(_unusedParam?: any): Promise<{
  events: RideSyncEvent[];
  latestTime: number;
  latestId?: string;
}> {
  const events: RideSyncEvent[] = [];
  const now = Math.floor(Date.now() / 1000);

  // 1. Busca eventos recentes no ntfy.sh (sem parâmetros quebrados de since)
  try {
    const res = await fetch(`${SYNC_URL}/json?poll=1`, {
      headers: { 'Accept': 'application/x-ndjson' },
    });

    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');

      // Se for a primeiríssima consulta do app, registra mensagens antigas para não reprocessar corridas antigas,
      // mas preserva DRIVER_STATUS recente para saber se o motorista já está online!
      if (!isInitialized) {
        isInitialized = true;
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            if (item.id) seenEventIds.add(item.id);

            // Permite capturar o último status de motorista online mesmo da primeira carga
            if (item.event === 'message' && item.message) {
              const payload = JSON.parse(item.message) as RideSyncEvent;
              if (payload?.type === 'DRIVER_STATUS' && payload.isOnline) {
                events.push(payload);
              }
            }
          } catch {}
        }
        return { events, latestTime: now };
      }

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (item.id && !seenEventIds.has(item.id)) {
            seenEventIds.add(item.id);
            // Mantém tamanho máximo de cache para não vazar memória
            if (seenEventIds.size > 1500) {
              const firstKey = seenEventIds.values().next().value;
              if (firstKey) seenEventIds.delete(firstKey);
            }

            if (item.event === 'message' && item.message) {
              const payload = JSON.parse(item.message) as RideSyncEvent;
              if (payload && payload.type) {
                events.push(payload);
              }
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[Sync] Falha no poll ntfy:', err);
  }

  // 2. Consulta de contingência no Backend VPS (SQLite) se ntfy falhar ou estiver vazio
  if (events.length === 0) {
    try {
      const vpsRes = await fetch(`${BACKEND_URL}/rides/sync/events`, {
        headers: { 'Accept': 'application/json' },
      });
      if (vpsRes.ok) {
        const json = await vpsRes.json();
        const list = json?.data || [];
        for (const item of list) {
          const evtId = `vps-${item.id}`;
          if (!seenEventIds.has(evtId)) {
            seenEventIds.add(evtId);
            const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
            if (payload && payload.type) {
              events.push(payload);
            }
          }
        }
      }
    } catch {}
  }

  return { events, latestTime: now };
}
