import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Car, Users, MapPin, DollarSign, ArrowRight, Settings } from 'lucide-react';
import { adminApi } from '../api/admin.api';
import { ridesApi } from '../api/rides.api';
import { StatsCard } from '../components/dashboard/StatsCard';
import { RevenueChart } from '../components/dashboard/RevenueChart';
import { RecentRides } from '../components/dashboard/RecentRides';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

// Dados mock para demonstração enquanto o backend não está disponível
const MOCK_STATS = {
  totalRides: 1_284,
  totalRevenue: 14_352.80,
  totalKm: 8_741.5,
  activeDrivers: 47,
  ridesGrowth: 12.4,
  revenueGrowth: 8.7,
  kmGrowth: 10.1,
  driversGrowth: 4.2,
};

const MOCK_REVENUE: { date: string; revenue: number; rides: number; km: number }[] = [
  { date: '24/10', revenue: 1850, rides: 168, km: 1020 },
  { date: '25/10', revenue: 2100, rides: 192, km: 1180 },
  { date: '26/10', revenue: 1700, rides: 154, km: 940 },
  { date: '27/10', revenue: 2400, rides: 218, km: 1340 },
  { date: '28/10', revenue: 2200, rides: 200, km: 1250 },
  { date: '29/10', revenue: 2800, rides: 255, km: 1600 },
  { date: '30/10', revenue: 1303, rides: 117, km: 748 },
];

const MOCK_RIDES: import('../types').Ride[] = [
  { id: 'abc123de', passengerId: 'p1', passengerName: 'Ana Silva', driverId: 'd1', driverName: 'Carlos Oliveira', distanceKm: 8.4, pricePerKm: 2.50, totalAmount: 21.00, driverShare: 18.48, platformShare: 2.52, status: 'completed', origin: 'Centro', destination: 'Asa Norte', requestedAt: new Date().toISOString() },
  { id: 'bcd234ef', passengerId: 'p2', passengerName: 'Pedro Costa', driverId: 'd2', driverName: 'Marcos Lima', distanceKm: 3.2, pricePerKm: 2.50, totalAmount: 8.00, driverShare: 7.04, platformShare: 0.96, status: 'in_progress', origin: 'Asa Sul', destination: 'Lago Norte', requestedAt: new Date().toISOString() },
  { id: 'cde345fg', passengerId: 'p3', passengerName: 'Lucia Martins', driverId: 'd3', driverName: 'José Santos', distanceKm: 12.1, pricePerKm: 2.50, totalAmount: 30.25, driverShare: 26.62, platformShare: 3.63, status: 'completed', origin: 'Taguatinga', destination: 'Plano Piloto', requestedAt: new Date().toISOString() },
  { id: 'def456gh', passengerId: 'p4', passengerName: 'Ricardo Alves', driverId: 'd4', driverName: 'Paulo Ferreira', distanceKm: 5.7, pricePerKm: 2.50, totalAmount: 14.25, driverShare: 12.54, platformShare: 1.71, status: 'cancelled', origin: 'Guará', destination: 'Ceilândia', requestedAt: new Date().toISOString() },
  { id: 'efg567hi', passengerId: 'p5', passengerName: 'Marina Souza', driverId: 'd5', driverName: 'Roberto Dias', distanceKm: 7.3, pricePerKm: 2.50, totalAmount: 18.25, driverShare: 16.06, platformShare: 2.19, status: 'completed', origin: 'Samambaia', destination: 'Brasília Shopping', requestedAt: new Date().toISOString() },
];
const MOCK_PRICING_PER_KM = 2.50;

/**
 * Dashboard principal com visão geral do negócio
 */
export function DashboardPage() {
  // Busca estatísticas do dashboard (com fallback para mock em dev)
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: adminApi.getDashboardStats,
    // Usa mock se a API falhar
    placeholderData: MOCK_STATS,
    retry: false,
  });

  const { data: revenueData, isLoading: isLoadingRevenue } = useQuery({
    queryKey: ['dashboard', 'revenue'],
    queryFn: () => adminApi.getRevenueChart(7),
    placeholderData: MOCK_REVENUE,
    retry: false,
  });

  const { data: recentRidesData, isLoading: isLoadingRides } = useQuery({
    queryKey: ['rides', 'recent'],
    queryFn: () => ridesApi.getRecentRides(10),
    retry: false,
  });

  const displayStats = stats ?? MOCK_STATS;
  const displayRevenue = revenueData ?? MOCK_REVENUE;
  const displayRides = recentRidesData ?? MOCK_RIDES;

  return (
    <div className="space-y-6">
      {/* Destaque: Preço atual por Km + link para configuração */}
      <div className="bg-gradient-to-r from-brand-amber/20 to-brand-amber/5 border border-brand-amber/30 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-amber/20 rounded-lg flex items-center justify-center">
            <Settings size={20} className="text-brand-amber" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Preço atual por Km</p>
            <p className="text-xl font-bold text-brand-amber">
              R$ {MOCK_PRICING_PER_KM.toFixed(2).replace('.', ',')} / km
            </p>
          </div>
        </div>
        <Link to="/pricing">
          <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
            Configurar preço
          </Button>
        </Link>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Corridas"
          value={isLoadingStats ? '...' : displayStats.totalRides.toLocaleString('pt-BR')}
          icon={Car}
          change={displayStats.ridesGrowth}
          iconColor="text-blue-400"
        />
        <StatsCard
          title="Receita Total"
          value={isLoadingStats ? '...' : `R$ ${displayStats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          change={displayStats.revenueGrowth}
          iconColor="text-brand-amber"
        />
        <StatsCard
          title="Km Rodados"
          value={isLoadingStats ? '...' : displayStats.totalKm.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          icon={MapPin}
          change={displayStats.kmGrowth}
          suffix="km"
          iconColor="text-purple-400"
        />
        <StatsCard
          title="Motoristas Ativos"
          value={isLoadingStats ? '...' : displayStats.activeDrivers}
          icon={Users}
          change={displayStats.driversGrowth}
          iconColor="text-green-400"
        />
      </div>

      {/* Gráfico de receita */}
      <Card
        title="Receita dos Últimos 7 Dias"
        subtitle="Valor total gerado pela plataforma (motorista + 88 Mobility)"
      >
        <RevenueChart data={displayRevenue} isLoading={isLoadingRevenue} />
      </Card>

      {/* Tabela de corridas recentes */}
      <Card
        title="Corridas Recentes"
        subtitle="Últimas 10 corridas registradas"
        noPadding
        rightContent={
          <Link to="/rides">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
              Ver todas
            </Button>
          </Link>
        }
      >
        <div className="px-6 pb-2">
          <RecentRides rides={displayRides} isLoading={isLoadingRides} />
        </div>
      </Card>
    </div>
  );
}
