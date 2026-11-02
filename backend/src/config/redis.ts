import Redis from 'ioredis';
import { env } from './env';

// Memória local para fallback quando Redis não estiver configurado
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private geoStore = new Map<string, Map<string, { lat: number; lng: number }>>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, { value });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + seconds * 1000,
    });
    return 'OK';
  }

  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
    }
    return count;
  }

  async zrem(key: string, member: string): Promise<number> {
    const geoMap = this.geoStore.get(key);
    if (geoMap && geoMap.delete(member)) {
      return 1;
    }
    return 0;
  }

  async call(command: string, ...args: (string | number)[]): Promise<any> {
    const cmd = command.toUpperCase();

    if (cmd === 'GEOADD') {
      const [key, lng, lat, member] = args as [string, string, string, string];
      if (!this.geoStore.has(key)) {
        this.geoStore.set(key, new Map());
      }
      this.geoStore.get(key)!.set(member, {
        lng: parseFloat(lng.toString()),
        lat: parseFloat(lat.toString()),
      });
      return 1;
    }

    if (cmd === 'GEORADIUS') {
      // args: [key, lng, lat, radius, unit, 'WITHCOORD', 'WITHDIST']
      const [key, centerLng, centerLat, radius] = args;
      const geoMap = this.geoStore.get(key as string);
      if (!geoMap) return [];

      const cLng = parseFloat(centerLng.toString());
      const cLat = parseFloat(centerLat.toString());
      const maxRadius = parseFloat(radius.toString());

      const results: any[] = [];
      for (const [member, pos] of geoMap.entries()) {
        const dist = this.haversine(cLat, cLng, pos.lat, pos.lng);
        if (dist <= maxRadius) {
          results.push([
            member,
            dist.toFixed(2),
            [pos.lng.toString(), pos.lat.toString()],
          ]);
        }
      }
      return results;
    }

    return null;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  on(_event: string, _cb: Function) {
    return this;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

let redisInstance: any;

if (env.REDIS_URL && env.REDIS_URL.trim() !== '') {
  try {
    const realRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: () => null, // Não trava o processo se não conectar
    });
    realRedis.on('connect', () => console.log('✅ Redis conectado'));
    realRedis.on('error', (err) => console.warn('⚠️  Redis indisponível, usando fallback em memória:', err.message));
    redisInstance = realRedis;
  } catch {
    console.log('ℹ️  Usando cache e Geo-index em memória (modo local sem Redis)');
    redisInstance = new InMemoryRedis();
  }
} else {
  console.log('ℹ️  Usando cache e Geo-index em memória (modo local sem Redis)');
  redisInstance = new InMemoryRedis();
}

export const redis = redisInstance;

// Chaves Redis usadas no projeto
export const REDIS_KEYS = {
  DRIVERS_ONLINE: 'geo:drivers:online',           // GEO index de motoristas online
  RIDE_REQUEST: (rideId: string) => `ride:${rideId}:request`, // Dados da solicitação
  DRIVER_ACTIVE_RIDE: (driverId: string) => `driver:${driverId}:active_ride`,
  PASSENGER_ACTIVE_RIDE: (passengerId: string) => `passenger:${passengerId}:active_ride`,
} as const;
