import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const subs = await prisma.tenantSubscription.findMany({
    include: {
      planVersion: {
        include: {
          plan: true,
        },
      },
      tenant: true,
    },
  });

  console.log('Current Subscriptions in DB:');
  for (const s of subs) {
    console.log({
      tenantId: s.tenantId,
      tenantName: s.tenant?.name,
      planCode: s.planVersion?.plan?.code,
      startedAt: s.startedAt,
      currentPeriodStart: s.currentPeriodStart,
      currentPeriodEnd: s.currentPeriodEnd,
    });

    // If it's a FREE_TRIAL, ensure currentPeriodEnd is startedAt + 14 days
    if (s.planVersion?.plan?.code === 'FREE_TRIAL' && s.currentPeriodStart) {
      const start = new Date(s.currentPeriodStart);
      const correctEnd = new Date(start);
      correctEnd.setDate(correctEnd.getDate() + 14);

      await prisma.tenantSubscription.update({
        where: { id: s.id },
        data: {
          currentPeriodEnd: correctEnd,
        },
      });
      console.log(`Updated FREE_TRIAL sub ${s.id} for tenant "${s.tenant?.name}" to 14 days (${correctEnd.toISOString()})`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
