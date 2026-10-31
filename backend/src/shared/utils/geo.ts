// ============================================================
// Utilitários de Geolocalização
// ============================================================

const EARTH_RADIUS_KM = 6371; // Raio médio da Terra em quilômetros

/**
 * Converte graus para radianos
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine.
 * Retorna a distância em quilômetros.
 *
 * @param lat1 - Latitude do ponto 1 (em graus decimais)
 * @param lon1 - Longitude do ponto 1 (em graus decimais)
 * @param lat2 - Latitude do ponto 2 (em graus decimais)
 * @param lon2 - Longitude do ponto 2 (em graus decimais)
 * @returns Distância em quilômetros
 *
 * @example
 * const km = haversineDistance(-23.5505, -46.6333, -22.9068, -43.1729); // SP → RJ
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100; // Arredonda para 2 casas decimais
}

/**
 * Estima o tempo de chegada em minutos baseado na distância e velocidade média.
 *
 * @param distanceKm - Distância em quilômetros
 * @param avgSpeedKmh - Velocidade média em km/h (padrão: 30 para trânsito urbano)
 * @returns Tempo estimado em minutos
 */
export function estimateArrivalMinutes(distanceKm: number, avgSpeedKmh = 30): number {
  const hours = distanceKm / avgSpeedKmh;
  return Math.ceil(hours * 60);
}

/**
 * Verifica se um ponto está dentro de um raio de um centro.
 *
 * @param centerLat - Latitude do centro
 * @param centerLng - Longitude do centro
 * @param pointLat - Latitude do ponto
 * @param pointLng - Longitude do ponto
 * @param radiusKm - Raio em quilômetros
 */
export function isWithinRadius(
  centerLat: number,
  centerLng: number,
  pointLat: number,
  pointLng: number,
  radiusKm: number
): boolean {
  return haversineDistance(centerLat, centerLng, pointLat, pointLng) <= radiusKm;
}
