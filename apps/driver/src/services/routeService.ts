// Serviço de rotas e navegação GPS (OSRM - Open Source Routing Machine)
// Obtém trajeto pelas ruas reais, geometria para desenhar no mapa e instruções passo a passo com nomes de rua

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  streetName: string;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string;
  maneuverModifier: string;
  location: RouteCoordinate;
}

export interface RouteResult {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

/**
 * Calcula o ângulo (bearing / heading) em graus entre duas coordenadas geográficas
 * 0° = Norte, 90° = Leste, 180° = Sul, 270° = Oeste
 */
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

/**
 * Calcula a distância em metros entre duas coordenadas geográficas via fórmula de Haversine
 */
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
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

/**
 * Constrói texto humanizado em português brasileiro para a fala de voz TTS
 */
function buildStepVoiceInstruction(
  step: any,
  isFirst: boolean,
  isLast: boolean,
  destinationName?: string
): string {
  if (isLast) {
    return destinationName
      ? `Você está chegando ao local: ${destinationName}.`
      : 'Você está chegando ao seu destino.';
  }

  const rawName = step.name?.trim();
  const street = rawName && rawName.length > 0 ? rawName : 'próxima via';
  const type = step.maneuver?.type || 'turn';
  const modifier = step.maneuver?.modifier || '';
  const dist = Math.round(step.distance || 0);

  let directionText = '';
  if (type === 'depart') {
    directionText = `Inicie o trajeto e siga na ${street}`;
  } else if (type === 'arrive') {
    return 'Você chegou ao local indicado.';
  } else if (modifier.includes('right')) {
    if (modifier.includes('slight')) {
      directionText = `Mantenha-se à direita na ${street}`;
    } else if (modifier.includes('sharp')) {
      directionText = `Curva fechada à direita na ${street}`;
    } else {
      directionText = `Vire à direita na ${street}`;
    }
  } else if (modifier.includes('left')) {
    if (modifier.includes('slight')) {
      directionText = `Mantenha-se à esquerda na ${street}`;
    } else if (modifier.includes('sharp')) {
      directionText = `Curva fechada à esquerda na ${street}`;
    } else {
      directionText = `Vire à esquerda na ${street}`;
    }
  } else if (type === 'roundabout' || type === 'rotary') {
    directionText = `Na rotatória, pegue a saída para a ${street}`;
  } else if (modifier.includes('uturn')) {
    directionText = `Faça o retorno na ${street}`;
  } else {
    directionText = `Continue em frente na ${street}`;
  }

  if (dist > 150 && !isFirst) {
    return `Em ${dist} metros, ${directionText.toLowerCase()}`;
  }
  return directionText;
}

/**
 * Busca a rota real de condução entre duas coordenadas usando a API de roteamento OSRM
 */
export async function fetchDrivingRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  destinationLabel?: string
): Promise<RouteResult> {
  const endpoints = [
    `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': '88Mobility-Driver/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) continue;

      const route = data.routes[0];
      const coords: RouteCoordinate[] = route.geometry.coordinates.map((c: [number, number]) => ({
        latitude: c[1],
        longitude: c[0],
      }));

      const rawSteps = route.legs?.[0]?.steps || [];
      const steps: RouteStep[] = rawSteps.map((s: any, idx: number) => {
        const isFirst = idx === 0;
        const isLast = idx === rawSteps.length - 1;
        const instruction = buildStepVoiceInstruction(s, isFirst, isLast, destinationLabel);
        const streetName = s.name?.trim() || (isLast ? (destinationLabel || 'Destino') : 'Via principal');

        const locCoord = s.maneuver?.location
          ? { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] }
          : coords[0];

        return {
          streetName,
          instruction,
          distanceMeters: s.distance || 0,
          durationSeconds: s.duration || 0,
          maneuverType: s.maneuver?.type || 'turn',
          maneuverModifier: s.maneuver?.modifier || 'straight',
          location: locCoord,
        };
      });

      return {
        coordinates: coords,
        distanceMeters: route.distance || 0,
        durationSeconds: route.duration || 0,
        steps,
      };
    } catch {
      // Tenta próximo endpoint
    }
  }

  console.warn('[RouteService] Fallback rota direta');
  // Fallback: Interpolação em linha reta caso todos os servidores estejam fora
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
    distanceMeters: 1000,
    durationSeconds: 180,
    steps: [
      {
        streetName: 'Via de acesso',
        instruction: 'Inicie o trajeto em direção ao passageiro.',
        distanceMeters: 500,
        durationSeconds: 90,
        maneuverType: 'depart',
        maneuverModifier: 'straight',
        location: fallbackCoords[0],
      },
      {
        streetName: destinationLabel || 'Local de embarque',
        instruction: 'Você está se aproximando do local de embarque.',
        distanceMeters: 500,
        durationSeconds: 90,
        maneuverType: 'arrive',
        maneuverModifier: 'straight',
        location: fallbackCoords[fallbackCoords.length - 1],
      },
    ],
  };
}
