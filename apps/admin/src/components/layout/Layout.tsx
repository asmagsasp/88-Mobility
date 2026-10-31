import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

/**
 * Layout principal do painel: Sidebar (esquerda) + Header + Conteúdo (direita)
 */
export function Layout() {
  return (
    <div className="flex min-h-screen bg-brand-dark">
      {/* Sidebar fixa à esquerda */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
