import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const DRIVER_BG_TASK = '88MOBILITY_DRIVER_BG_TASK';

// URL do canal de sincronização em tempo real
const SYNC_URL = 'https://ntfy.sh/88mobility_live_rides_sync';

// Controle de estado em memória dentro da task (não pode usar React state aqui)
let _lastBgPollTime = Math.floor(Date.now() / 1000) - 60;
let _rejectedRideIds: Set<string> = new Set();
let _activeRideId: string | null = null;

/** Permite que o HomeScreen informe ao BG Task qual corrida está ativa (evita notificar novamente) */
export function setBgActiveRide(rideId: string | null) {
  _activeRideId = rideId;
}

/** Permite que o HomeScreen informe ao BG Task quais corridas já foram recusadas */
export function addBgRejectedRideId(rideId: string) {
  _rejectedRideIds.add(rideId);
}

let _bgDriverInfo: { id: string; name: string; vehicle: string; plate: string } | null = null;
let _lastBgHeartbeat = 0;

export function setBgDriverInfo(info: { id: string; name: string; vehicle: string; plate: string } | null) {
  _bgDriverInfo = info;
}

// Manipulador padrão de notificações para exibir banner mesmo com o app em primeiro ou segundo plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Polling leve de corridas — executado dentro do BG Task
 * Faz fetch no ntfy.sh e dispara notificação local se houver nova chamada de passageiro
 */
async function pollAndNotifyInBackground() {
  try {
    const sinceParam = `&since=${_lastBgPollTime}`;
    const res = await fetch(`${SYNC_URL}/json?poll=1${sinceParam}`, {
      headers: { Accept: 'application/x-ndjson' },
    });

    if (!res.ok) return;

    const text = await res.text();
    const lines = text.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const item = JSON.parse(line);

        if (item.time && item.time > _lastBgPollTime) {
          _lastBgPollTime = item.time;
        }

        if (item.event === 'message' && item.message) {
          const payload = JSON.parse(item.message);
          if (!payload || !payload.type) continue;

          // Nova chamada de passageiro
          if (payload.type === 'REQUEST_RIDE' && payload.ride) {
            const ride = payload.ride;

            // Ignora se já recusou ou já está em andamento
            if (_rejectedRideIds.has(ride.id)) continue;
            if (_activeRideId && _activeRideId === ride.id) continue;

            const valorFormatado = Number(ride.driverShare || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });

            await Notifications.scheduleNotificationAsync({
              content: {
                title: `🚗 Nova Chamada! (${valorFormatado})`,
                body: `Passageiro(a): ${ride.passengerName} • Buscar em: ${ride.origin?.address || 'Local desconhecido'}`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
                vibrate: [0, 400, 200, 400, 200, 400],
                data: { rideId: ride.id, type: 'REQUEST_RIDE' },
                ...(Platform.OS === 'android' && { channelId: 'driver-rides-channel' }),
              },
              trigger: null,
            });
          }

          // Passageiro cancelou — avisa o motorista mesmo em background
          if (
            payload.type === 'CANCEL_RIDE' &&
            (_activeRideId === payload.rideId || _activeRideId === null)
          ) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Corrida Cancelada ⚠️',
                body: 'O passageiro cancelou o pedido de corrida.',
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                vibrate: [0, 300, 200, 300],
                data: { rideId: payload.rideId, type: 'CANCEL_RIDE' },
                ...(Platform.OS === 'android' && { channelId: 'driver-rides-channel' }),
              },
              trigger: null,
            });
          }
        }
      } catch {
        // Ignora linha inválida
      }
    }
  } catch (err) {
    console.warn('[Driver BG Poll] Erro ao consultar eventos:', err);
  }
}

// Registra a tarefa em segundo plano para manter a thread do app viva no Android
// e faz polling de corridas mesmo com o app minimizado
if (!TaskManager.isTaskDefined(DRIVER_BG_TASK)) {
  TaskManager.defineTask(DRIVER_BG_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[Driver BG Task] Erro:', error);
      return;
    }
    // 1. Transmite heartbeat de online para os passageiros mesmo com o app minimizado
    if (_bgDriverInfo && data && (data as any).locations && (data as any).locations.length > 0) {
      const loc = (data as any).locations[0].coords;
      if (loc && Date.now() - _lastBgHeartbeat > 6000) {
        _lastBgHeartbeat = Date.now();
        fetch(SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'DRIVER_STATUS' },
          body: JSON.stringify({
            type: 'DRIVER_STATUS',
            driverId: _bgDriverInfo.id,
            isOnline: true,
            latitude: loc.latitude,
            longitude: loc.longitude,
            vehicle: _bgDriverInfo.vehicle,
            plate: _bgDriverInfo.plate,
            name: _bgDriverInfo.name,
          }),
        }).catch(() => {});
      }
    }

    // 2. Faz o polling de novas corridas
    await pollAndNotifyInBackground();
  });
}

/**
 * Inicializa permissões e canais de alta prioridade para o app do motorista
 */
export async function initNotificationService(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permissão de notificações não concedida no app do motorista.');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('driver-rides-channel', {
        name: 'Chamadas de Corridas 88 Mobility',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300, 200, 300],
        lightColor: '#10B981',
        enableLights: true,
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }

    return true;
  } catch (err) {
    console.warn('Erro ao inicializar serviço de notificações do motorista:', err);
    return false;
  }
}

/**
 * Dispara uma notificação local imediata de alta prioridade
 */
export async function sendRideNotification(title: string, body: string, data?: Record<string, any>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 300, 200, 300],
        data: data || {},
        ...(Platform.OS === 'android' && { channelId: 'driver-rides-channel' }),
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('Erro ao agendar notificação do motorista:', err);
  }
}

/**
 * Inicia o serviço em primeiro plano (Foreground Service) do Android para o motorista
 * Mantém o app ativo em segundo plano enquanto o motorista usa o Waze, Google Maps ou WhatsApp
 */
export async function startBackgroundKeepAlive(
  title: string = '88 Mobility — Motorista',
  body: string = 'Você está online e pronto para receber chamadas de passageiros.'
) {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_BG_TASK).catch(() => false);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(DRIVER_BG_TASK).catch(() => {});
    }

    await Location.startLocationUpdatesAsync(DRIVER_BG_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3000,
      distanceInterval: 0,  // dispara a cada 3s independentemente do movimento
      foregroundService: {
        notificationTitle: title,
        notificationBody: body,
        notificationColor: '#10B981',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
  } catch (err) {
    console.warn('Erro ao iniciar background keep-alive do motorista:', err);
  }
}

/**
 * Finaliza o serviço em segundo plano quando o motorista fica Offline
 */
export async function stopBackgroundKeepAlive() {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_BG_TASK).catch(() => false);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(DRIVER_BG_TASK);
    }
  } catch (err) {
    console.warn('Erro ao parar background keep-alive do motorista:', err);
  }
}

