import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const PASSENGER_BG_TASK = '88MOBILITY_PASSENGER_BG_TASK';

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

// Registra a tarefa em segundo plano para manter a thread do app viva no Android
if (!TaskManager.isTaskDefined(PASSENGER_BG_TASK)) {
  TaskManager.defineTask(PASSENGER_BG_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[BG Task] Erro na tarefa em segundo plano:', error);
      return;
    }
  });
}

/**
 * Inicializa permissões e canais de alta prioridade para Android
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
      console.warn('Permissão de notificações não concedida pelo usuário.');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('rides-channel', {
        name: 'Corridas 88 Mobility',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F59E0B',
        enableLights: true,
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });
    }

    return true;
  } catch (err) {
    console.warn('Erro ao inicializar serviço de notificações:', err);
    return false;
  }
}

/**
 * Dispara uma notificação local heads-up imediata (aparece sobreposta ao YouTube/outros apps)
 */
export async function sendRideNotification(title: string, body: string, data?: Record<string, any>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        data: data || {},
        ...(Platform.OS === 'android' && { channelId: 'rides-channel' }),
      },
      trigger: null, // Disparo imediato
    });
  } catch (err) {
    console.warn('Erro ao agendar notificação:', err);
  }
}

/**
 * Inicia o serviço em primeiro plano (Foreground Service) do Android
 * Garante que o Android NÃO encerre a conexão de rede nem o polling enquanto o passageiro assiste ao YouTube
 *
 * IMPORTANTE: Verifica permissões ANTES de chamar startLocationUpdatesAsync.
 * Sem essa verificação, o app trava no Android 10+ quando a permissão
 * "Permitir sempre" não foi concedida pelo usuário.
 */
export async function startBackgroundKeepAlive(
  title: string = '88 Mobility',
  body: string = 'Procurando motoristas próximos...'
) {
  try {
    // Verifica permissão de localização em foreground (mínimo necessário)
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      console.warn('[BG KeepAlive] Permissão de localização foreground não concedida. Abortando.');
      return;
    }

    // No Android, verifica se a permissão de background foi concedida.
    // Se não foi, retorna sem erro — o polling React continua funcionando em foreground.
    if (Platform.OS === 'android') {
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('[BG KeepAlive] Permissão de background location não concedida. Polling ativo apenas em foreground.');
        return;
      }
    }

    // Para iOS, background location exige permissão "Always"
    if (Platform.OS === 'ios') {
      const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('[BG KeepAlive] iOS: permissão "Always" não concedida. Abortando.');
        return;
      }
    }

    // Para antes de reiniciar (evita erro de task já registrada)
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(PASSENGER_BG_TASK).catch(() => false);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(PASSENGER_BG_TASK).catch(() => {});
    }

    await Location.startLocationUpdatesAsync(PASSENGER_BG_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 4000,
      distanceInterval: 10,
      foregroundService: {
        notificationTitle: title,
        notificationBody: body,
        notificationColor: '#F59E0B',
      },
      pausesUpdatesAutomatically: false,
    });
  } catch (err) {
    // Captura qualquer erro inesperado sem deixar o app travar
    console.warn('Erro ao iniciar background keep-alive:', err);
  }
}

/**
 * Finaliza o serviço em segundo plano quando a corrida é encerrada
 */
export async function stopBackgroundKeepAlive() {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(PASSENGER_BG_TASK).catch(() => false);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(PASSENGER_BG_TASK);
    }
  } catch (err) {
    console.warn('Erro ao parar background keep-alive:', err);
  }
}
