/**
 * Mock de desenvolvimento — intercepta respostas de rede (ECONNREFUSED / Network Error)
 * e retorna dados locais, permitindo usar o painel sem backend.
 *
 * Estratégia: response interceptor que captura falhas de rede e serve mock.
 * Isso é mais confiável do que tentar curto-circuitar o request interceptor.
 */

import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { PricingConfig, Driver, PeakHourConfig } from '../types';

// ── Estado em memória (simula banco de dados durante a sessão) ─────────────

let currentPricing: PricingConfig = {
  id: 'p1',
  pricePerKm: 2.50,
  setBy: 'Admin (mock)',
  setAt: new Date().toISOString(),
};

let pricingHistory: PricingConfig[] = [
  { id: 'p1', pricePerKm: 2.50, setBy: 'Admin', setAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), notes: 'Ajuste de mercado' },
  { id: 'p2', pricePerKm: 2.20, setBy: 'Admin', setAt: new Date(Date.now() - 10 * 86_400_000).toISOString(), notes: 'Promoção de lançamento' },
  { id: 'p3', pricePerKm: 2.80, setBy: 'Admin', setAt: new Date(Date.now() - 20 * 86_400_000).toISOString() },
];

let peakConfig: PeakHourConfig = {
  id: 'peak-001',
  enabled: true,
  surgeAmount: 2.00,
  surgeType: 'per_ride',
  slots: [{ start: '07:00', end: '09:00' }, { start: '17:00', end: '19:30' }],
  weekdays: [1, 2, 3, 4, 5],
  updatedAt: new Date().toISOString(),
  updatedBy: 'Admin (mock)',
};

let drivers: Driver[] = [
  { id: 'd1', name: 'Abel Magalhães', email: 'abel.souza.magalhaes@hotmail.com', phone: '(11) 98888-8888', cpf: '123.456.789-00', vehicle: 'Honda Fit', vehiclePlate: 'BRA-8888', vehicleYear: 2021, rating: 5.0, totalRides: 342, totalKm: 4820, status: 'online', createdAt: '2024-01-15T00:00:00Z' },
  { id: 'd2', name: 'Marcos Lima', email: 'marcos@gmail.com', phone: '(11) 99999-0002', cpf: '222.333.444-55', vehicle: 'Honda Civic 2020', vehiclePlate: 'DEF-5678', vehicleYear: 2020, rating: 4.8, totalRides: 218, totalKm: 3100, status: 'online', createdAt: '2024-02-20T00:00:00Z' },
  { id: 'd3', name: 'José Santos', email: 'jose@gmail.com', phone: '(11) 99999-0003', cpf: '333.444.555-66', vehicle: 'VW Polo 2022', vehiclePlate: 'GHI-9012', vehicleYear: 2022, rating: 4.9, totalRides: 521, totalKm: 7340, status: 'offline', createdAt: '2023-11-05T00:00:00Z' },
  { id: 'd4', name: 'Paulo Ferreira', email: 'paulo@gmail.com', phone: '(11) 99999-0004', cpf: '444.555.666-77', vehicle: 'Hyundai HB20 2021', vehiclePlate: 'JKL-3456', vehicleYear: 2021, rating: 0, totalRides: 0, totalKm: 0, status: 'pending', createdAt: '2026-10-28T00:00:00Z' },
  { id: 'd5', name: 'Roberto Dias', email: 'roberto@gmail.com', phone: '(11) 99999-0005', cpf: '555.666.777-88', vehicle: 'Chevrolet Onix 2020', vehiclePlate: 'MNO-7890', vehicleYear: 2020, rating: 4.7, totalRides: 45, totalKm: 630, status: 'blocked', createdAt: '2024-06-10T00:00:00Z' },
  { id: 'd6', name: 'Ana Costa', email: 'ana@gmail.com', phone: '(11) 99999-0006', cpf: '666.777.888-99', vehicle: 'Fiat Argo 2023', vehiclePlate: 'PQR-2345', vehicleYear: 2023, rating: 0, totalRides: 0, totalKm: 0, status: 'pending', createdAt: '2026-10-29T00:00:00Z' },
];

const MOCK_RIDES = [
  { id: 'r001', passengerId: 'p1', passengerName: 'Ana Silva', driverId: 'd1', driverName: 'Abel Magalhães', origin: 'Centro', destination: 'Jardins', distanceKm: 8.4, pricePerKm: 2.50, totalAmount: 21.00, driverShare: 18.48, platformShare: 2.52, status: 'completed', requestedAt: new Date(Date.now() - 30 * 60_000).toISOString() },
  { id: 'r002', passengerId: 'p2', passengerName: 'Pedro Costa', driverId: 'd2', driverName: 'Marcos Lima', origin: 'Vila Mariana', destination: 'Pinheiros', distanceKm: 3.2, pricePerKm: 2.50, totalAmount: 8.00, driverShare: 7.04, platformShare: 0.96, status: 'in_progress', requestedAt: new Date(Date.now() - 10 * 60_000).toISOString() },
  { id: 'r003', passengerId: 'p3', passengerName: 'Lucia Martins', driverId: 'd3', driverName: 'José Santos', origin: 'Moema', destination: 'Paulista', distanceKm: 12.1, pricePerKm: 2.50, totalAmount: 30.25, driverShare: 26.62, platformShare: 3.63, status: 'completed', requestedAt: new Date(Date.now() - 90 * 60_000).toISOString() },
  { id: 'r004', passengerId: 'p4', passengerName: 'Ricardo Alves', driverId: 'd4', driverName: 'Paulo Ferreira', origin: 'Santana', destination: 'Tatuapé', distanceKm: 5.7, pricePerKm: 2.50, totalAmount: 14.25, driverShare: 12.54, platformShare: 1.71, status: 'cancelled', requestedAt: new Date(Date.now() - 60 * 60_000).toISOString() },
  { id: 'r005', passengerId: 'p5', passengerName: 'Marina Souza', driverId: 'd5', driverName: 'Roberto Dias', origin: 'Morumbi', destination: 'Shopping Morumbi', distanceKm: 7.3, pricePerKm: 2.50, totalAmount: 18.25, driverShare: 16.06, platformShare: 2.19, status: 'completed', requestedAt: new Date(Date.now() - 120 * 60_000).toISOString() },
  { id: 'r006', passengerId: 'p6', passengerName: 'João Mendes', driverId: 'd1', driverName: 'Abel Magalhães', origin: 'Itaim Bibi', destination: 'Vila Olímpia', distanceKm: 6.8, pricePerKm: 2.50, totalAmount: 17.00, driverShare: 14.96, platformShare: 2.04, status: 'requested', requestedAt: new Date(Date.now() - 2 * 60_000).toISOString() },
];

// ── Resolvedor de rotas mock ────────────────────────────────────────────────

function resolve(method: string, url: string, body: unknown): unknown {
  const M = method.toUpperCase();
  const path = url.split('?')[0];

  // Dashboard
  if (M === 'GET' && /\/dashboard\/stats/.test(path))
    return { totalRides: 1284, totalRevenue: 14352.80, totalKm: 8741.5, activeDrivers: 47, ridesGrowth: 12.4, revenueGrowth: 8.7, kmGrowth: 10.1, driversGrowth: 4.2 };

  if (M === 'GET' && /\/dashboard\/revenue/.test(path))
    return [
      { date: '24/10', revenue: 1850, rides: 168, km: 1020 },
      { date: '25/10', revenue: 2100, rides: 192, km: 1180 },
      { date: '26/10', revenue: 1700, rides: 154, km: 940 },
      { date: '27/10', revenue: 2400, rides: 218, km: 1340 },
      { date: '28/10', revenue: 2200, rides: 200, km: 1250 },
      { date: '29/10', revenue: 2800, rides: 255, km: 1600 },
      { date: '30/10', revenue: 1303, rides: 117, km: 748 },
    ];

  // Pricing base
  if (M === 'GET' && /\/pricing\/current/.test(path)) return currentPricing;
  if (M === 'GET' && /\/pricing\/history/.test(path)) return pricingHistory;
  if (M === 'POST' && /\/pricing$/.test(path)) {
    const { pricePerKm, notes } = body as { pricePerKm: number; notes?: string };
    const next: PricingConfig = { id: `p${Date.now()}`, pricePerKm, notes, setBy: 'Admin', setAt: new Date().toISOString() };
    pricingHistory = [currentPricing, ...pricingHistory].slice(0, 10);
    currentPricing = next;
    return next;
  }

  // Peak hours
  if (M === 'GET' && /\/peak-hours$/.test(path)) return peakConfig;
  if (M === 'PUT' && /\/peak-hours$/.test(path)) {
    peakConfig = { ...peakConfig, ...(body as Partial<PeakHourConfig>), updatedAt: new Date().toISOString(), updatedBy: 'Admin' };
    return peakConfig;
  }
  if (M === 'PATCH' && /\/peak-hours\/toggle/.test(path)) {
    peakConfig = { ...peakConfig, enabled: (body as { enabled: boolean }).enabled, updatedAt: new Date().toISOString() };
    return peakConfig;
  }

  // Drivers
  if (M === 'GET' && /\/drivers$/.test(path))
    return { data: drivers, total: drivers.length, page: 1, perPage: 10, totalPages: 1 };

  if (M === 'PATCH' && /\/drivers\/.+\/approve/.test(path)) {
    const id = path.match(/\/drivers\/(.+)\/approve/)?.[1];
    drivers = drivers.map(d => d.id === id ? { ...d, status: 'online' as const, approvedAt: new Date().toISOString() } : d);
    return drivers.find(d => d.id === id);
  }
  if (M === 'PATCH' && /\/drivers\/.+\/block/.test(path)) {
    const id = path.match(/\/drivers\/(.+)\/block/)?.[1];
    drivers = drivers.map(d => d.id === id ? { ...d, status: 'blocked' as const } : d);
    return drivers.find(d => d.id === id);
  }

  // Rides
  if (M === 'GET' && /\/rides\/recent/.test(path)) return MOCK_RIDES;
  if (M === 'GET' && /\/rides$/.test(path))
    return { data: MOCK_RIDES, total: MOCK_RIDES.length, page: 1, perPage: 15, totalPages: 1 };

  return null; // sem mock → deixa cair na rede
}

// ── Registro do interceptor ────────────────────────────────────────────────

export function registerMockInterceptor(instance: AxiosInstance): void {
  // Intercepta no REQUEST, antes de ir para a rede
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const url   = config.url ?? '';
    const method = config.method ?? 'GET';
    let body: unknown;
    try { body = config.data ? JSON.parse(config.data) : undefined; } catch { body = config.data; }

    const result = resolve(method, url, body);
    if (result === null) return config; // sem mock, vai para a rede normalmente

    // Simula latência de rede
    await new Promise(r => setTimeout(r, 150 + Math.random() * 150));

    // Substitui o adapter para retornar dados locais sem network call
    config.adapter = () =>
      Promise.resolve({
        data: result,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config,
        request: {},
      });

    return config;
  });

  console.info('%c[88 Mobility] 🟡 Mock API ativo — sem necessidade de backend', 'color:#F59E0B;font-weight:bold');
}
