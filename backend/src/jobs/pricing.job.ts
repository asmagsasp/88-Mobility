import { prisma } from '../config/database';

// ============================================================
// Pricing Job — Monitoramento e cache de preços
// ============================================================

/**
 * Verifica e registra a configuração de preço ativa.
 * Em produção, pode ser chamado via cron (ex: a cada hora)
 * para alertar admins caso não haja configuração de preço ativa.
 */
export async function checkPricingConfig(): Promise<void> {
  try {
    const activeConfig = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeConfig) {
      console.warn(
        '⚠️  [PricingJob] ATENÇÃO: Nenhuma configuração de preço ativa encontrada! ' +
        'Acesse o painel admin e configure o preço por Km.'
      );
    } else {
      console.log(
        `✅ [PricingJob] Preço ativo: R$${activeConfig.pricePerKm.toFixed(2)}/Km | ` +
        `Split: ${(activeConfig.driverSplit * 100).toFixed(0)}% motorista / ` +
        `${(activeConfig.platformSplit * 100).toFixed(0)}% plataforma`
      );
    }
  } catch (err) {
    console.error('[PricingJob] Erro ao verificar configuração de preço:', err);
  }
}

/**
 * Seed de preço padrão — cria configuração inicial se não existir.
 * Deve ser chamado no bootstrap da aplicação.
 *
 * @param adminId - ID do usuário admin que será registrado como autor
 * @param defaultPricePerKm - Preço padrão por Km (default: R$ 2,50)
 */
export async function seedDefaultPricing(
  adminId: string,
  defaultPricePerKm = 2.5
): Promise<void> {
  const existing = await prisma.pricingConfig.findFirst({ where: { isActive: true } });

  if (existing) {
    console.log(`ℹ️  [PricingJob] Configuração de preço já existe: R$${existing.pricePerKm}/Km`);
    return;
  }

  await prisma.pricingConfig.create({
    data: {
      pricePerKm: defaultPricePerKm,
      driverSplit: 0.88,
      platformSplit: 0.12,
      isActive: true,
      updatedBy: adminId,
    },
  });

  console.log(`✅ [PricingJob] Preço padrão criado: R$${defaultPricePerKm}/Km`);
}
