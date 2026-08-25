const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createOrg() {
  const plan = await prisma.plan.findUnique({
    where: { code: 'FREE_TRIAL' },
    include: { versions: { where: { isActive: true }, take: 1 } }
  });
  const planVersion = plan.versions[0];
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(now.getDate() + 14);

  // Check if tenant exists
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'org-5915' }
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'فلاي سبيدو',
        slug: 'org-5915',
        city: 'كربلاء المقدسة',
        country: 'العراق',
        baseCurrency: 'IQD',
        status: 'ACTIVE',
        isRoot: false,
      }
    });
  }

  // Company
  let company = await prisma.company.findFirst({
    where: { tenantId: tenant.id }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'فلاي سبيدو',
        code: 'CMP-5915',
        currency: 'IQD',
        phone: '',
        email: '',
        address: 'كربلاء المقدسة',
        isDefault: true,
      }
    });
  }

  // Branch
  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id }
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        companyId: company.id,
        code: 'BR-01',
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        city: 'كربلاء المقدسة',
        isMain: true,
        status: 'نشط',
      }
    });
  }

  // Role
  let role = await prisma.role.findFirst({
    where: { companyId: company.id }
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        name: 'المدير العام',
        description: 'صلاحيات كاملة للمؤسسة',
        permissions: JSON.stringify(['*']),
        allowedBranches: 'جميع الفروع',
        companyId: company.id,
      }
    });
  }

  // User
  const hashedPassword = await bcrypt.hash('alsaady@1', 10);
  let user = await prisma.user.findUnique({
    where: { email: 'acc2.rooda10@gmail.com' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'acc2.rooda10@gmail.com',
        name: 'علي جعفر',
        password: hashedPassword,
        plainPassword: 'alsaady@1',
        companyId: company.id,
        roleId: role.id,
        isActive: true,
      }
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        plainPassword: 'alsaady@1',
        companyId: company.id,
        roleId: role.id,
        isActive: true,
      }
    });
  }

  // Membership
  const existingMembership = await prisma.tenantMembership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      }
    }
  });

  if (!existingMembership) {
    await prisma.tenantMembership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: 'OWNER',
        isPrimary: true,
        isActive: true,
      }
    });
  }

  // Subscription
  const existingSub = await prisma.tenantSubscription.findFirst({
    where: { tenantId: tenant.id }
  });

  if (!existingSub) {
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planVersionId: planVersion.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        lockedPriceCents: 0,
        currency: 'USD',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
      }
    });
  }

  console.log('🎉 SUCCESS: Organization "فلاي سبيدو" and User "acc2.rooda10@gmail.com" created and verified!');
}

createOrg().catch(console.error).finally(() => prisma.$disconnect());
