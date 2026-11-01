import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter } from 'lucide-react';
import { ridesApi } from '../api/rides.api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import type { Ride, RideStatus } from '../types';

type StatusFilter = 'all' | RideStatus;

// Mapeamento de status para badge
function getStatusBadge(status: RideStatus) {
  const map: Record<RideStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    completed:   { label: 'Concluída', variant: 'success' },
    in_progress: { label: 'Em andamento', variant: 'info' },
    requested:   { label: 'Solicitada', variant: 'warning' },
    accepted:    { label: 'Aceita', variant: 'info' },
    cancelled:   { label: 'Cancelada', variant: 'danger' },
  };
  return map[status] ?? { label: status, variant: 'default' };
}

const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Dados mock
const MOCK_RIDES: Ride[] = [
  { id: 'r001', passengerName: 'Ana Silva', passengerId: 'p1', driverId: 'd1', driverName: 'Abel Magalhães', origin: 'Centro', destination: 'Jardins', distanceKm: 8.4, pricePerKm: 2.50, totalAmount: 21.00, driverShare: 18.48, platformShare: 2.52, status: 'completed', requestedAt: new Date(Date.now() - 30 * 60_000).toISOString(), completedAt: new Date().toISOString() },
  { id: 'r002', passengerName: 'Pedro Costa', passengerId: 'p2', driverId: 'd2', driverName: 'Marcos Lima', origin: 'Vila Mariana', destination: 'Pinheiros', distanceKm: 3.2, pricePerKm: 2.50, totalAmount: 8.00, driverShare: 7.04, platformShare: 0.96, status: 'in_progress', requestedAt: new Date(Date.now() - 10 * 60_000).toISOString() },
  { id: 'r003', passengerName: 'Lucia Martins', passengerId: 'p3', driverId: 'd3', driverName: 'José Santos', origin: 'Moema', destination: 'Paulista', distanceKm: 12.1, pricePerKm: 2.50, totalAmount: 30.25, driverShare: 26.62, platformShare: 3.63, status: 'completed', requestedAt: new Date(Date.now() - 90 * 60_000).toISOString(), completedAt: new Date(Date.now() - 45 * 60_000).toISOString() },
  { id: 'r004', passengerName: 'Ricardo Alves', passengerId: 'p4', driverId: 'd4', driverName: 'Paulo Ferreira', origin: 'Santana', destination: 'Tatuapé', distanceKm: 5.7, pricePerKm: 2.50, totalAmount: 14.25, driverShare: 12.54, platformShare: 1.71, status: 'cancelled', requestedAt: new Date(Date.now() - 60 * 60_000).toISOString() },
  { id: 'r005', passengerName: 'Marina Souza', passengerId: 'p5', driverId: 'd5', driverName: 'Roberto Dias', origin: 'Morumbi', destination: 'Shopping Morumbi', distanceKm: 7.3, pricePerKm: 2.50, totalAmount: 18.25, driverShare: 16.06, platformShare: 2.19, status: 'completed', requestedAt: new Date(Date.now() - 120 * 60_000).toISOString(), completedAt: new Date(Date.now() - 80 * 60_000).toISOString() },
  { id: 'r006', passengerName: 'João Mendes', passengerId: 'p6', driverId: 'd1', driverName: 'Abel Magalhães', origin: 'Itaim Bibi', destination: 'Vila Olímpia', distanceKm: 6.8, pricePerKm: 2.50, totalAmount: 17.00, driverShare: 14.96, platformShare: 2.04, status: 'requested', requestedAt: new Date(Date.now() - 2 * 60_000).toISOString() },
];

/**
 * Página de corridas com filtros, busca e paginação
 */
export function RidesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: ridesData, isLoading } = useQuery({
    queryKey: ['rides', { status: statusFilter, page, search }],
    queryFn: () => ridesApi.getRides({
      status: statusFilter === 'all' ? undefined : statusFilter,
      page,
      perPage: 15,
    }),
    placeholderData: {
      data: MOCK_RIDES,
      total: MOCK_RIDES.length,
      page: 1,
      perPage: 15,
      totalPages: 1,
    },
    retry: false,
  });

  const displayRides = ridesData?.data ?? MOCK_RIDES;

  const filteredRides = displayRides.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = !search ||
      r.passengerName.toLowerCase().includes(search.toLowerCase()) ||
      r.driverName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'completed', label: 'Concluídas' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'requested', label: 'Solicitadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ];

  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (r: Ride) => (
        <span className="font-mono text-xs text-slate-400">#{r.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'passengerName',
      header: 'Passageiro',
      render: (r: Ride) => <span className="text-white font-medium">{r.passengerName}</span>,
    },
    {
      key: 'driverName',
      header: 'Motorista',
    },
    {
      key: 'route',
      header: 'Rota',
      render: (r: Ride) => (
        <div className="text-xs">
          <p className="text-white">{r.origin}</p>
          <p className="text-slate-400">→ {r.destination}</p>
        </div>
      ),
    },
    {
      key: 'distanceKm',
      header: 'Distância',
      render: (r: Ride) => `${r.distanceKm.toFixed(1)} km`,
    },
    {
      key: 'totalAmount',
      header: 'Valor Total',
      render: (r: Ride) => (
        <div>
          <p className="text-brand-amber font-semibold">{formatBRL(r.totalAmount)}</p>
          <p className="text-xs text-slate-500">{formatBRL(r.pricePerKm)}/km</p>
        </div>
      ),
    },
    {
      key: 'split',
      header: 'Split (88/12)',
      render: (r: Ride) => (
        <div className="text-xs">
          <p className="text-green-400">Motorista: {formatBRL(r.driverShare)}</p>
          <p className="text-brand-amber">Plataforma: {formatBRL(r.platformShare)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: Ride) => {
        const { label, variant } = getStatusBadge(r.status);
        return <Badge variant={variant} dot>{label}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por passageiro ou motorista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-brand-dark border border-brand-dark-border text-white rounded-lg pl-9 pr-4 py-2.5
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-amber focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-1 bg-brand-dark rounded-lg p-1 border border-brand-dark-border">
            <Filter size={14} className="text-slate-500 ml-2" />
            {statusFilters.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setStatusFilter(value); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  statusFilter === value
                    ? 'bg-brand-amber text-brand-dark'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Tabela de corridas */}
      <Card
        title={`Corridas (${filteredRides.length})`}
        subtitle="Histórico e acompanhamento de todas as corridas"
        noPadding
      >
        <div className="px-6 pb-4">
          <Table
            columns={columns}
            data={filteredRides}
            keyExtractor={(r) => r.id}
            isLoading={isLoading}
            emptyMessage="Nenhuma corrida encontrada"
          />
        </div>

        {(ridesData?.totalPages ?? 1) > 1 && (
          <div className="px-6 py-4 border-t border-brand-dark-border flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Página {page} de {ridesData?.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page === ridesData?.totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
