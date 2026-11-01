// Serviço de sincronização em tempo real entre Passageiro e Motorista via ponte de rede (ntfy.sh)
// Funciona 100% sem necessidade de servidor local, chaves de API pagas ou configurações complexas.

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
  | { type: 'ACCEPT_RIDE'; rideId: string; driver: { name: string; vehicle: string; plate: string; phone: string; rating: number } }
  | { type: 'DRIVER_LOCATION'; rideId: string; latitude: number; longitude: number; heading: number }
  | { type: 'ARRIVED_PASSENGER'; rideId: string }
  | { type: 'START_TRIP'; rideId: string }
  | { type: 'DECLINE_RIDE'; rideId: string }
  | { type: 'COMPLETE_RIDE'; rideId: string }
  | { type: 'CANCEL_RIDE'; rideId: string };

/**
 * Publica um evento no canal em tempo real
 */
export async function publishRideEvent(event: RideSyncEvent): Promise<boolean> {
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
