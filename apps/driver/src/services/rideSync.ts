// Serviço de sincronização em tempo real entre Passageiro e Motorista
// Integração dupla: Banco SQLite no Backend + Ponte de eventos em tempo real (ntfy.sh)

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
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
  | { type: 'DRIVER_STATUS'; driverId: string; isOnline: boolean; latitude?: number; longitude?: number; vehicle?: string; plate?: string; name?: string };

/**
 * Publica um evento no canal em tempo real e persiste no SQLite do Backend
 */
export async function publishRideEvent(event: RideSyncEvent): Promise<boolean> {
  // 1. Salva evento no banco de dados SQLite do Backend se disponível
  try {
    const rideId = 'ride' in event ? event.ride.id : ('rideId' in event ? event.rideId : 'global');
    fetch(`${BACKEND_URL}/rides/sync/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, type: event.type, payload: event }),
    }).catch(() => {});
  } catch {}

  // 2. Transmite via ponte em tempo real
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
 * Busca eventos recentes no canal
 */
export async function pollRideEvents(sinceSeconds?: number): Promise<{ events: RideSyncEvent[]; latestTime: number }> {
  try {
    const sinceParam = sinceSeconds ? `&since=${sinceSeconds}` : '&since=5m';
    const res = await fetch(`${SYNC_URL}/json?poll=1${sinceParam}`, {
      headers: { 'Accept': 'application/x-ndjson' },
    });

    if (!res.ok) return { events: [], latestTime: sinceSeconds || Math.floor(Date.now() / 1000) };

    const text = await res.text();
    const lines = text.trim().split('\n');
    const events: RideSyncEvent[] = [];
    let latestTime = sinceSeconds || Math.floor(Date.now() / 1000);

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);
        if (item.time && item.time > latestTime) {
          latestTime = item.time;
        }
        if (item.event === 'message' && item.message) {
          const payload = JSON.parse(item.message) as RideSyncEvent;
          if (payload && payload.type) {
            events.push(payload);
          }
        }
      } catch {
        // Ignora linha com formato inválido
      }
    }

    return { events, latestTime };
  } catch (err) {
    console.warn('[Sync] Erro ao consultar eventos:', err);
    return { events: [], latestTime: sinceSeconds || Math.floor(Date.now() / 1000) };
  }
}
