import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados SQLite (88 Mobility)...');

  const passwordHash = await bcrypt.hash('123456', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@88mobility2026', 10);

  // 1. Cria Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@88mobility.com' },
    update: {},
    create: {
      name: 'Administrador 88',
      email: 'admin@88mobility.com',
      phone: '+5511999990001',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });
  console.log('✅ Admin criado:', admin.email);

  // 2. Configuração de Preço (R$ 2,50/km, R$ 2,00 taxa fixa, 88% motorista, 12% plataforma)
  const existingConfig = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
  });

  if (!existingConfig) {
    const pricing = await prisma.pricingConfig.create({
      data: {
        pricePerKm: 2.5,
        platformFee: 2.0,
        driverSplit: 0.88,
        platformSplit: 0.12,
        isActive: true,
        updatedBy: admin.id,
      },
    });
    console.log('✅ Configuração de Preço criada:', `R$ ${pricing.pricePerKm}/km | Taxa R$ ${pricing.platformFee}`);
  }

  // 3. Motorista padrão com Honda Fit e PIX
  const driverUser = await prisma.user.upsert({
    where: { email: 'motorista@88mobility.com' },
    update: {},
    create: {
      name: 'Carlos Oliveira',
      email: 'motorista@88mobility.com',
      phone: '+5511988880002',
      passwordHash,
      role: 'DRIVER',
      isVerified: true,
      rating: 4.95,
      driverProfile: {
        create: {
          licenseNumber: '12345678900',
          licenseExpiry: new Date('2028-12-31'),
          vehiclePlate: 'BRA2E19',
          vehicleModel: 'Honda Fit',
          vehicleYear: 2020,
          vehicleColor: 'Prata',
          vehicleRenavam: '00987654321',
          cnhPhotoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
          crlvPhotoUrl: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2',
          pixKeyType: 'CPF',
          pixKey: '123.456.789-00',
          pixBankName: 'Nubank',
          pixAccountHolder: 'Carlos Oliveira',
          isApproved: true,
          documentsVerified: true,
          isOnline: true,
          currentLat: -23.55052,
          currentLng: -46.633308,
          totalKm: 142.5,
          totalEarnings: 314.8,
        },
      },
    },
  });
  console.log('✅ Motorista criado:', driverUser.name, '(Honda Fit)');

  // 4. Passageiro padrão
  const passengerUser = await prisma.user.upsert({
    where: { email: 'passageiro@88mobility.com' },
    update: {},
    create: {
      name: 'Ana Souza',
      email: 'passageiro@88mobility.com',
      phone: '+5511977770003',
      passwordHash,
      role: 'PASSENGER',
      isVerified: true,
      rating: 5.0,
    },
  });
  console.log('✅ Passageiro criado:', passengerUser.name);

  // 5. Histórico de corridas exemplo
  const existingRides = await prisma.ride.count();
  if (existingRides === 0) {
    await prisma.ride.create({
      data: {
        passengerId: passengerUser.id,
        driverId: driverUser.id,
        status: 'COMPLETED',
        originLat: -23.5505,
        originLng: -46.6333,
        originAddress: 'Av. Paulista, 1000 - Bela Vista',
        destinationLat: -23.5615,
        destinationLng: -46.6559,
        destinationAddress: 'Rua Augusta, 1500 - Consolação',
        estimatedKm: 3.2,
        actualKm: 3.2,
        pricePerKm: 2.5,
        platformFee: 2.0,
        totalAmount: 10.0,
        driverAmount: 7.04, // 88% de R$ 8.00
        platformAmount: 2.96, // 12% + R$ 2.00
        paymentMethod: 'PIX',
        paymentStatus: 'PAID',
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(Date.now() - 3000000),
      },
    });

    await prisma.ride.create({
      data: {
        passengerId: passengerUser.id,
        driverId: driverUser.id,
        status: 'COMPLETED',
        originLat: -23.562,
        originLng: -46.656,
        originAddress: 'Shopping Cidade São Paulo',
        destinationLat: -23.587,
        destinationLng: -46.678,
        destinationAddress: 'Parque Ibirapuera - Portão 3',
        estimatedKm: 5.4,
        actualKm: 5.5,
        pricePerKm: 2.5,
        platformFee: 2.0,
        totalAmount: 15.75,
        driverAmount: 12.1,
        platformAmount: 3.65,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        startedAt: new Date(Date.now() - 7200000),
        completedAt: new Date(Date.now() - 6300000),
      },
    });
    console.log('✅ Corridas de exemplo criadas');
  }

  console.log('🎉 Seed do banco SQLite concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
