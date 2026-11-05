import { prisma } from './src/config/database';
import { createInfinitePayCheckout, handleInfinitePayWebhook, getRidePaymentStatus } from './src/modules/payments/infinitepay.service';
import { getDriverPayouts } from './src/modules/payments/payout.service';

async function runTest() {
  console.log('🧪 ========================================================');
  console.log('🧪 TESTE DE INTEGRAÇÃO: INFINITEPAY + REPASSE PIX 88%');
  console.log('🧪 ========================================================\n');

  // 1. Localiza ou cria um passageiro de teste
  let passenger = await prisma.user.findFirst({ where: { role: 'PASSENGER' } });
  if (!passenger) {
    passenger = await prisma.user.create({
      data: {
        name: 'Passageiro Teste',
        email: 'passageiro@teste.com',
        phone: '11999990001',
        passwordHash: 'dummy',
        role: 'PASSENGER',
      },
    });
  }

  // 2. Localiza ou cria um motorista com chave PIX cadastrada
  let driver = await prisma.user.findFirst({
    where: { role: 'DRIVER' },
    include: { driverProfile: true },
  });

  if (!driver) {
    driver = await prisma.user.create({
      data: {
        name: 'Abel Motorista Parceiro',
        email: 'abel.driver@teste.com',
        phone: '11988887777',
        passwordHash: 'dummy',
        role: 'DRIVER',
        driverProfile: {
          create: {
            licenseNumber: 'CNH-12345678',
            vehiclePlate: 'BRA8888',
            vehicleModel: 'Honda Fit',
            vehicleColor: 'Prata',
            vehicleYear: 2022,
            pixKeyType: 'CPF',
            pixKey: '123.456.789-00',
            pixBankName: 'Nubank',
            pixAccountHolder: 'Abel Motorista Parceiro',
            isApproved: true,
            isOnline: true,
          },
        },
      },
      include: { driverProfile: true },
    });
  } else if (!driver.driverProfile?.pixKey) {
    await prisma.driverProfile.update({
      where: { userId: driver.id },
      data: {
        pixKeyType: 'CPF',
        pixKey: '123.456.789-00',
        pixBankName: 'Nubank',
        pixAccountHolder: driver.name,
      },
    });
  }

  // 3. Cria uma corrida de teste concluída
  const testRide = await prisma.ride.create({
    data: {
      passengerId: passenger.id,
      driverId: driver.id,
      status: 'COMPLETED',
      originLat: -23.55052,
      originLng: -46.633308,
      originAddress: 'Av. Paulista, 1000 - Bela Vista, SP',
      destinationLat: -23.561684,
      destinationLng: -46.655981,
      destinationAddress: 'Rua Augusta, 1500 - Consolação, SP',
      estimatedKm: 10.0,
      actualKm: 10.0,
      pricePerKm: 2.50,
      platformFee: 2.00,
      totalAmount: 27.00,       // 10km * 2.50 = 25.00 + 2.00 = R$ 27.00
      driverAmount: 22.00,      // 88% de 25.00 = R$ 22.00
      platformAmount: 5.00,     // 12% de 25.00 (3.00) + 2.00 fee = R$ 5.00
      paymentMethod: 'PIX',
      paymentStatus: 'PENDING',
    },
  });

  console.log(`✅ Corrida de teste criada: #${testRide.id}`);
  console.log(`   - Valor Total: R$ ${testRide.totalAmount?.toFixed(2)}`);
  console.log(`   - Repasse Motorista (88% do Km): R$ ${testRide.driverAmount?.toFixed(2)}`);
  console.log(`   - Plataforma (12% do Km + taxa): R$ ${testRide.platformAmount?.toFixed(2)}`);
  console.log(`   - Chave PIX do Motorista: ${driver.driverProfile?.pixKey} (${driver.driverProfile?.pixBankName})\n`);

  // 4. Cria sessão no checkout da InfinitePay
  console.log('👉 [Passo 1] Gerando sessão no Checkout InfinitePay...');
  const checkoutResult = await createInfinitePayCheckout(testRide.id, passenger.id);
  console.log('   - Checkout URL gerada:', checkoutResult.checkoutUrl);
  console.log('   - Order NSU:', checkoutResult.orderNsu);
  console.log('   - É Sandbox/Demo:', checkoutResult.isSandbox);

  // 5. Simula o Webhook da InfinitePay (Pagamento realizado via PIX pelo passageiro)
  console.log('\n👉 [Passo 2] Simulando Webhook de confirmação de pagamento da InfinitePay...');
  const webhookResult = await handleInfinitePayWebhook({
    event: 'paid',
    order_nsu: testRide.id,
    transaction_nsu: 'infinite_tx_' + Date.now(),
    amount: 2700, // 27.00 em centavos
    paid_amount: 2700,
    capture_method: 'pix',
    receipt_url: 'https://pay.infinitepay.io/receipt/test',
  });

  console.log('   - Resposta do Webhook:', webhookResult);

  // 6. Verifica o status final da corrida e do repasse no banco
  console.log('\n👉 [Passo 3] Consultando status no banco de dados...');
  const finalStatus = await getRidePaymentStatus(testRide.id);
  console.log('   - Status da Corrida:', finalStatus.rideStatus);
  console.log('   - Status do Pagamento:', finalStatus.paymentStatus);
  console.log('   - Gateway utilizado:', finalStatus.payment?.gateway);
  console.log('   - Repasse ao Motorista (Payout):', finalStatus.payout);

  const payouts = await getDriverPayouts(driver.id);
  console.log(`\n🎉 Total de repasses registrados para o motorista: ${payouts.length}`);
  console.log(`   - Último repasse: R$ ${payouts[0]?.amount} para chave ${payouts[0]?.pixKey} [${payouts[0]?.status}]`);

  // Validações assertivas
  if (finalStatus.paymentStatus === 'PAID' && finalStatus.payout?.status === 'COMPLETED') {
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO ABSOLUTO! TUDO FUNCIONANDO 100%!');
  } else {
    console.error('\n❌ Falha na validação do teste.');
  }

  await prisma.$disconnect();
}

runTest().catch((err) => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
