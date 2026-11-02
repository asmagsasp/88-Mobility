// Serviço de rotas OSRM para traçar trajeto do motorista no aplicativo do passageiro

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
}

export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = toDeg(Math.atan2(y, x));
  return (theta + 360) % 360;
}

export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function fetchPassengerRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> {
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': '88Mobility-Passenger/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) continue;

      const route = data.routes[0];
      const coordinates: RouteCoordinate[] = route.geometry.coordinates.map((c: [number, number]) => ({
        latitude: c[1],
        longitude: c[0],
      }));

      return {
        coordinates,
        distanceMeters: route.distance || 0,
        durationSeconds: route.duration || 0,
      };
    } catch {
      // Tenta próximo
    }
  }

  console.warn('[RoutePassenger] Fallback linha suave');
  const stepsCount = 10;
  const fallbackCoords: RouteCoordinate[] = [];
  for (let i = 0; i <= stepsCount; i++) {
    const t = i / stepsCount;
    fallbackCoords.push({
      latitude: startLat + (endLat - startLat) * t,
      longitude: startLng + (endLng - startLng) * t,
    });
  }

  return {
    coordinates: fallbackCoords,
    distanceMeters: 800,
    durationSeconds: 120,
  };
}
