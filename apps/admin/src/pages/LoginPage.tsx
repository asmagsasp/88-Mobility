import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../stores/auth.store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

// Schema de validação Zod
const loginSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Tela de login do painel admin — design escuro com accent âmbar
 */
export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: import.meta.env.DEV ? 'admin@88mobility.com' : '',
      password: import.meta.env.DEV ? 'admin123' : '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error?.response?.data?.message ?? 'Email ou senha incorretos';
      setError('root', { message });
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      {/* Fundo com gradient sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-amber/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card de login */}
        <div className="bg-brand-dark-card border border-brand-dark-border rounded-2xl p-8 shadow-2xl">
          {/* Logo 88 */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/logo.jpg"
              alt="88 Mobility Logo"
              className="w-20 h-20 rounded-2xl object-cover mb-4 shadow-lg shadow-brand-amber/20 border border-brand-amber/30"
            />
            <h1 className="text-2xl font-bold text-white">88 Mobility</h1>
            <p className="text-slate-400 text-sm mt-1">Painel Administrativo</p>
          </div>

          {/* Hint de credenciais — visível apenas em desenvolvimento */}
          {import.meta.env.DEV && (
            <div className="flex items-start gap-2 p-3 bg-brand-amber/10 border border-brand-amber/30 rounded-lg text-xs text-brand-amber-light mb-1">
              <span className="text-brand-amber font-bold mt-0.5">DEV</span>
              <div>
                <p className="font-semibold text-brand-amber">Credenciais de desenvolvimento:</p>
                <p className="mt-0.5 font-mono">admin@88mobility.com</p>
                <p className="font-mono">admin123</p>
              </div>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email"
              type="email"
              placeholder="admin@88mobility.com"
              leftIcon={<Mail size={16} />}
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock size={16} />}
              error={errors.password?.message}
              autoComplete="current-password"
              {...register('password')}
            />

            {/* Erro global (credenciais inválidas) */}
            {errors.root && (
              <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                {errors.root.message}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              Entrar no Painel
            </Button>
          </form>

          {/* Rodapé */}
          <p className="text-center text-xs text-slate-600 mt-6">
            88 Mobility © {new Date().getFullYear()} — Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
