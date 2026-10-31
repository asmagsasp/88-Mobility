import { Car } from 'lucide-react';
import { Table } from '../ui/Table';
import { Badge } from '../ui/Badge';
import type { Ride, RideStatus } from '../../types';

interface RecentRidesProps {
  rides: Ride[];
  isLoading?: boolean;
}

// Mapeamento de status para variante do badge
function getStatusBadge(status: RideStatus) {
  const map: Record<RideStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'default' }> = {
    completed: { label: 'Concluída', variant: 'success' },
    in_progress: { label: 'Em andamento', variant: 'info' },
    requested: { label: 'Solicitada', variant: 'warning' },
    accepted: { label: 'Aceita', variant: 'info' },
    cancelled: { label: 'Cancelada', variant: 'danger' },
  };
  return map[status] ?? { label: status, variant: 'default' };
}

/**
 * Tabela das corridas mais recentes para o dashboard
 */
export function RecentRides({ rides, isLoading }: RecentRidesProps) {
  const columns = [
    {
      key: 'id',
      header: 'ID',
      render: (ride: Ride) => (
        <span className="font-mono text-xs text-slate-400">#{ride.id.slice(0, 8)}</span>
      ),
    },
    {
      key: 'passengerName',
      header: 'Passageiro',
      render: (ride: Ride) => (
        <span className="text-white font-medium">{ride.passengerName}</span>
      ),
    },
    {
      key: 'driverName',
      header: 'Motorista',
    },
    {
      key: 'distanceKm',
      header: 'Km',
      render: (ride: Ride) => `${ride.distanceKm.toFixed(1)} km`,
    },
    {
      key: 'totalAmount',
      header: 'Valor',
      render: (ride: Ride) => (
        <span className="text-brand-amber font-semibold">
          R$ {ride.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ride: Ride) => {
        const { label, variant } = getStatusBadge(ride.status);
        return <Badge variant={variant} dot>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      {rides.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Car size={40} className="mb-3 opacity-50" />
          <p>Nenhuma corrida recente</p>
        </div>
      ) : (
        <Table
          columns={columns}
          data={rides}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="Sem corridas recentes"
        />
      )}
    </div>
  );
}
