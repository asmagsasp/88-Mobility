import Redis from 'ioredis';
import { env } from './env';

// Cria o cliente Redis com opções de reconexão automática
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    // Reconecta com backoff exponencial (máx 5 segundos)
    const delay = Math.min(times * 100, 5000);
    console.log(`🔄 Redis reconectando... tentativa ${times} (delay: ${delay}ms)`);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET'];
    if (targetErrors.some((e) => err.message.includes(e))) {
      return true; // Reconecta apenas em erros específicos
    }
    return false;
  },
});

redis.on('connect', () => console.log('✅ Redis conectado'));
redis.on('error', (err) => console.error('❌ Redis erro:', err.message));
redis.on('close', () => console.warn('⚠️  Redis desconectado'));

// Chaves Redis usadas no projeto
export const REDIS_KEYS = {
  DRIVERS_ONLINE: 'geo:drivers:online',           // GEO index de motoristas online
  RIDE_REQUEST: (rideId: string) => `ride:${rideId}:request`, // Dados da solicitação
  DRIVER_ACTIVE_RIDE: (driverId: string) => `driver:${driverId}:active_ride`,
  PASSENGER_ACTIVE_RIDE: (passengerId: string) => `passenger:${passengerId}:active_ride`,
} as const;
