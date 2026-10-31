import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, UserX, Search, Filter } from 'lucide-react';
import { adminApi } from '../api/admin.api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import type { Driver, DriverStatus } from '../types';

// Mapeamento de status para badge
function getDriverStatusBadge(status: DriverStatus) {
  const map: Record<DriverStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
    online:   { label: 'Online', variant: 'success' },
    offline:  { label: 'Offline', variant: 'default' },
    pending:  { label: 'Pendente', variant: 'warning' },
    blocked:  { label: 'Bloqueado', variant: 'danger' },
  };
  return map[status] ?? { label: status, variant: 'default' };
}

// Dados mock
const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Carlos Oliveira', email: 'carlos@gmail.com', phone: '(61) 99999-0001', cpf: '111.222.333-44', vehicle: 'Toyota Corolla 2021', vehiclePlate: 'ABC-1234', vehicleYear: 2021, rating: 4.8, totalRides: 342, totalKm: 4820, status: 'online', createdAt: '2024-01-15T00:00:00Z' },
  { id: 'd2', name: 'Marcos Lima', email: 'marcos@gmail.com', phone: '(61) 99999-0002', cpf: '222.333.444-55', vehicle: 'Honda Civic 2020', vehiclePlate: 'DEF-5678', vehicleYear: 2020, rating: 4.6, totalRides: 218, totalKm: 3100, status: 'online', createdAt: '2024-02-20T00:00:00Z' },
  { id: 'd3', name: 'José Santos', email: 'jose@gmail.com', phone: '(61) 99999-0003', cpf: '333.444.555-66', vehicle: 'VW Polo 2022', vehiclePlate: 'GHI-9012', vehicleYear: 2022, rating: 4.9, totalRides: 521, totalKm: 7340, status: 'offline', createdAt: '2023-11-05T00:00:00Z' },
  { id: 'd4', name: 'Paulo Ferreira', email: 'paulo@gmail.com', phone: '(61) 99999-0004', cpf: '444.555.666-77', vehicle: 'Hyundai HB20 2021', vehiclePlate: 'JKL-3456', vehicleYear: 2021, rating: 0, totalRides: 0, totalKm: 0, status: 'pending', createdAt: '2026-10-28T00:00:00Z' },
  { id: 'd5', name: 'Roberto Dias', email: 'roberto@gmail.com', phone: '(61) 99999-0005', cpf: '555.666.777-88', vehicle: 'Chevrolet Onix 2020', vehiclePlate: 'MNO-7890', vehicleYear: 2020, rating: 3.2, totalRides: 45, totalKm: 630, status: 'blocked', createdAt: '2024-06-10T00:00:00Z' },
  { id: 'd6', name: 'Ana Costa', email: 'ana@gmail.com', phone: '(61) 99999-0006', cpf: '666.777.888-99', vehicle: 'Fiat Argo 2023', vehiclePlate: 'PQR-2345', vehicleYear: 2023, rating: 0, totalRides: 0, totalKm: 0, status: 'pending', createdAt: '2026-10-29T00:00:00Z' },
];

type StatusFilter = 'all' | DriverStatus;

/**
 * Página de gestão de motoristas com aprovação, bloqueio e filtros
 */
export function DriversPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Busca motoristas
  const { data: driversData, isLoading } = useQuery({
    queryKey: ['drivers', { status: statusFilter, page, search }],
    queryFn: () => adminApi.getDrivers({
      status: statusFilter === 'all' ? undefined : statusFilter,
      page,
      perPage: 10,
      search,
    }),
    placeholderData: {
      data: MOCK_DRIVERS,
      total: MOCK_DRIVERS.length,
      page: 1,
      perPage: 10,
      totalPages: 1,
    },
    retry: false,
  });

  // Mutações de ação
  const { mutateAsync: approve, isPending: isApproving } = useMutation({
    mutationFn: adminApi.approveDriver,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const { mutateAsync: block, isPending: isBlocking } = useMutation({
    mutationFn: (id: string) => adminApi.blockDriver(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const displayDrivers = driversData?.data ?? MOCK_DRIVERS;

  // Filtros client-side para mock
  const filteredDrivers = displayDrivers.filter((d) => {
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.vehicle.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'blocked', label: 'Bloqueados' },
  ];

  const columns = [
    {
      key: 'name',
      header: 'Motorista',
      render: (d: Driver) => (
        <div>
          <p className="font-medium text-white">{d.name}</p>
          <p className="text-xs text-slate-500">{d.email}</p>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Veículo',
      render: (d: Driver) => (
        <div>
          <p className="text-white text-sm">{d.vehicle}</p>
          <p className="text-xs text-slate-500 font-mono">{d.vehiclePlate}</p>
        </div>
      ),
    },
    {
      key: 'rating',
      header: 'Avaliação',
      render: (d: Driver) =>
        d.rating > 0 ? (
          <span className="flex items-center gap-1 text-brand-amber font-semibold">
            ⭐ {d.rating.toFixed(1)}
          </span>
        ) : (
          <span className="text-slate-500 text-sm">Sem avaliação</span>
        ),
    },
    {
      key: 'totalRides',
      header: 'Corridas',
      render: (d: Driver) => (
        <div>
          <p className="text-white">{d.totalRides}</p>
          <p className="text-xs text-slate-500">{d.totalKm.toLocaleString('pt-BR')} km</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d: Driver) => {
        const { label, variant } = getDriverStatusBadge(d.status);
        return <Badge variant={variant} dot>{label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (d: Driver) => (
        <div className="flex gap-2">
          {d.status === 'pending' && (
            <Button
              variant="success"
              size="sm"
              leftIcon={<UserCheck size={14} />}
              isLoading={isApproving}
              onClick={() => approve(d.id)}
            >
              Aprovar
            </Button>
          )}
          {(d.status === 'online' || d.status === 'offline' || d.status === 'pending') && d.status !== 'pending' && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<UserX size={14} />}
              isLoading={isBlocking}
              onClick={() => block(d.id)}
            >
              Bloquear
            </Button>
          )}
          {d.status === 'pending' && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<UserX size={14} />}
              isLoading={isBlocking}
              onClick={() => block(d.id)}
            >
              Recusar
            </Button>
          )}
          {d.status === 'blocked' && (
            <Button variant="ghost" size="sm" disabled>Bloqueado</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou veículo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-brand-dark border border-brand-dark-border text-white rounded-lg pl-9 pr-4 py-2.5
                         placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-amber focus:border-transparent"
            />
          </div>

          {/* Filtro de status */}
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

      {/* Tabela de motoristas */}
      <Card
        title={`Motoristas (${filteredDrivers.length})`}
        subtitle="Gerencie aprovações, bloqueios e status dos motoristas"
        noPadding
      >
        <div className="px-6 pb-4">
          <Table
            columns={columns}
            data={filteredDrivers}
            keyExtractor={(d) => d.id}
            isLoading={isLoading}
            emptyMessage="Nenhum motorista encontrado"
          />
        </div>

        {/* Paginação */}
        {(driversData?.totalPages ?? 1) > 1 && (
          <div className="px-6 py-4 border-t border-brand-dark-border flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Página {page} de {driversData?.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === driversData?.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
