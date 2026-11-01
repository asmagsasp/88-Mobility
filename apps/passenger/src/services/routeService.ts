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

export async function fetchPassengerRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`OSRM HTTP status ${res.status}`);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('Nenhuma rota encontrada');
    }

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
  } catch (err) {
    console.warn('[RoutePassenger] Fallback linha suave:', err);
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
}
