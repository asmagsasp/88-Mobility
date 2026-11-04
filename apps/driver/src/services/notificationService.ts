import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const DRIVER_BG_TASK = '88MOBILITY_DRIVER_BG_TASK';

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
if (!TaskManager.isTaskDefined(DRIVER_BG_TASK)) {
  TaskManager.defineTask(DRIVER_BG_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[Driver BG Task] Erro:', error);
      return;
    }
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
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: title,
        notificationBody: body,
        notificationColor: '#10B981',
      },
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
