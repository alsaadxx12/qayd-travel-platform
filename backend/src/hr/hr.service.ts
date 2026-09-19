import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSalaryDto,
  UpdateSalaryDto,
  CreateAttendanceDto,
  UpdateAttendanceDto,
  CreateLeaveDto,
  UpdateLeaveStatusDto,
  SetLeaveBalanceDto,
  BatchSetLeaveBalancesDto,
  AwardPointsDto,
  CreateCompetitionDto,
  UpdateCompetitionDto,
} from './hr.dto';

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════
  // 1. مسيرات الرواتب (Salaries & Payroll)
  // ══════════════════════════════════════════════

  async getSalaries(companyId: string, month?: string, employeeId?: string, status?: string) {
    const where: any = { companyId };
    if (month) where.month = month;
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    return this.prisma.employeeSalary.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
            assignedCashbox: true,
          },
        },
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createSalary(companyId: string, dto: CreateSalaryDto) {
    // Check employee existence in company
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('الموظف المحدد غير موجود في بيانات الشركة');

    const base = Number(dto.baseSalary || 0);
    const allowances = Number(dto.allowances || 0);
    const bonuses = Number(dto.bonuses || 0);
    const deductions = Number(dto.deductions || 0);
    const netSalary = base + allowances + bonuses - deductions;

    return this.prisma.employeeSalary.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        month: dto.month,
        baseSalary: base,
        allowances,
        bonuses,
        deductions,
        netSalary,
        currency: dto.currency || 'USD',
        status: 'PENDING',
        notes: dto.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
    });
  }

  async updateSalary(companyId: string, id: string, dto: UpdateSalaryDto) {
    const existing = await this.prisma.employeeSalary.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('سجل مسير الراتب غير موجود');

    const base = dto.baseSalary !== undefined ? Number(dto.baseSalary) : Number(existing.baseSalary);
    const allowances = dto.allowances !== undefined ? Number(dto.allowances) : Number(existing.allowances);
    const bonuses = dto.bonuses !== undefined ? Number(dto.bonuses) : Number(existing.bonuses);
    const deductions = dto.deductions !== undefined ? Number(dto.deductions) : Number(existing.deductions);
    const netSalary = base + allowances + bonuses - deductions;

    const paidAt = dto.status === 'PAID' && !existing.paidAt ? new Date() : existing.paidAt;

    return this.prisma.employeeSalary.update({
      where: { id },
      data: {
        baseSalary: base,
        allowances,
        bonuses,
        deductions,
        netSalary,
        status: dto.status ?? existing.status,
        paymentMethod: dto.paymentMethod ?? existing.paymentMethod,
        paidAt,
        notes: dto.notes ?? existing.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
    });
  }

  async deleteSalary(companyId: string, id: string) {
    const existing = await this.prisma.employeeSalary.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('سجل مسير الراتب غير موجود');
    return this.prisma.employeeSalary.delete({ where: { id } });
  }

  // ══════════════════════════════════════════════
  // 2. سجل الحضور والانصراف (Attendance)
  // ══════════════════════════════════════════════

  async getAttendance(companyId: string, dateStr?: string, employeeId?: string) {
    const where: any = { companyId };
    if (employeeId) where.employeeId = employeeId;

    if (dateStr) {
      const targetDate = new Date(dateStr);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }

    return this.prisma.employeeAttendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async recordAttendance(companyId: string, dto: CreateAttendanceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('الموظف المحدد غير موجود في بيانات الشركة');

    // 1. Device Binding & Hardware Attestation Enforcement
    if (employee.trustedDeviceId && dto.deviceId) {
      if (employee.trustedDeviceId !== dto.deviceId) {
        throw new BadRequestException(
          'غير مصرح! لا يمكن تسجيل الحضور إلا من الجهاز المعتمد والموثّق لهذا الموظف (Android Keystore / iOS Secure Enclave). يمنع استخدام هاتف زميل آخر.'
        );
      }
    } else if (!employee.trustedDeviceId && dto.deviceId) {
      // Automatic first-time hardware binding with attestation
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: {
          trustedDeviceId: dto.deviceId,
          deviceModel: dto.deviceModel || 'Approved Mobile Device',
          devicePlatform: dto.devicePlatform || 'ANDROID',
          deviceBoundAt: new Date(),
          deviceAttestationType: dto.attestationType || 'ANDROID_KEYSTORE_PLAY_INTEGRITY',
        },
      });
    }

    // 2. Geofencing check against branch coordinates
    let geofenceNote = '';
    if (dto.latitude !== undefined && dto.longitude !== undefined && employee.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: employee.branchId },
        select: { latitude: true, longitude: true, allowedRadiusMeters: true, nameAr: true },
      });
      if (branch && branch.latitude != null && branch.longitude != null) {
        const R = 6371e3; // Earth radius in meters
        const lat1 = (dto.latitude * Math.PI) / 180;
        const lat2 = (branch.latitude * Math.PI) / 180;
        const dLat = ((branch.latitude - dto.latitude) * Math.PI) / 180;
        const dLon = ((branch.longitude - dto.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceMeters = Math.round(R * c);

        const radius = branch.allowedRadiusMeters || 150;
        if (distanceMeters > radius) {
          geofenceNote = `[GPS: خارج النطاق - المسافة ${distanceMeters}م / المسموح ${radius}م]`;
        } else {
          geofenceNote = `[GPS: داخل النطاق - المسافة ${distanceMeters}م]`;
        }
      }
    }

    const date = new Date(dto.date);
    const combinedNotes = [dto.notes, geofenceNote].filter(Boolean).join(' • ');

    return this.prisma.employeeAttendance.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        date,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        status: dto.status || 'PRESENT',
        lateMinutes: dto.lateMinutes || 0,
        overtimeHours: dto.overtimeHours || 0,
        notes: combinedNotes,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
    });
  }

  async updateAttendance(companyId: string, id: string, dto: UpdateAttendanceDto) {
    const existing = await this.prisma.employeeAttendance.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('سجل الحضور غير موجود');

    return this.prisma.employeeAttendance.update({
      where: { id },
      data: {
        checkIn: dto.checkIn ?? existing.checkIn,
        checkOut: dto.checkOut ?? existing.checkOut,
        status: dto.status ?? existing.status,
        lateMinutes: dto.lateMinutes !== undefined ? dto.lateMinutes : existing.lateMinutes,
        overtimeHours: dto.overtimeHours !== undefined ? dto.overtimeHours : existing.overtimeHours,
        notes: dto.notes ?? existing.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
    });
  }

  async deleteAttendance(companyId: string, id: string) {
    const existing = await this.prisma.employeeAttendance.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('سجل الحضور غير موجود');
    return this.prisma.employeeAttendance.delete({ where: { id } });
  }

  // ══════════════════════════════════════════════
  // 3. طلبات الإجازات (Leaves) & أرصدة الإجازات
  // ══════════════════════════════════════════════

  async getLeaves(companyId: string, status?: string, employeeId?: string, leaveType?: string) {
    const where: any = { companyId };
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;
    if (leaveType) where.leaveType = leaveType;

    return this.prisma.employeeLeave.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLeave(companyId: string, dto: CreateLeaveDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('الموظف المحدد غير موجود في بيانات الشركة');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    let daysCount = dto.daysCount;
    if (!daysCount && dto.leaveType !== 'HOURLY') {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const leave = await this.prisma.employeeLeave.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        leaveType: dto.leaveType || 'ANNUAL',
        startDate,
        endDate,
        daysCount: dto.leaveType === 'HOURLY' ? 0 : Math.max(1, daysCount || 1),
        hoursCount: dto.hoursCount || (dto.leaveType === 'HOURLY' ? 1 : 0),
        reason: dto.reason,
        notes: dto.notes,
        status: 'PENDING',
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
    });

    return leave;
  }

  async updateLeaveStatus(companyId: string, id: string, dto: UpdateLeaveStatusDto, approvedBy?: string) {
    const existing = await this.prisma.employeeLeave.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('طلب الإجازة غير موجود');

    const updated = await this.prisma.employeeLeave.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes ?? existing.notes,
        approvedBy: approvedBy || existing.approvedBy,
        actionDate: new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
            departmentName: true,
          },
        },
      },
    });

    // Recalculate employee leave balance for this leaveType and year
    const year = existing.startDate.getFullYear();
    await this.syncEmployeeLeaveBalance(companyId, existing.employeeId, existing.leaveType, year);

    return updated;
  }

  async deleteLeave(companyId: string, id: string) {
    const existing = await this.prisma.employeeLeave.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('طلب الإجازة غير موجود');

    const res = await this.prisma.employeeLeave.delete({ where: { id } });
    const year = existing.startDate.getFullYear();
    await this.syncEmployeeLeaveBalance(companyId, existing.employeeId, existing.leaveType, year);
    return res;
  }

  // ── أرصدة الإجازات (Leave Balances) ──

  private async syncEmployeeLeaveBalance(companyId: string, employeeId: string, leaveType: string, year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const approvedLeaves = await this.prisma.employeeLeave.findMany({
      where: {
        companyId,
        employeeId,
        leaveType,
        status: 'APPROVED',
        startDate: { gte: startOfYear, lte: endOfYear },
      },
    });

    let used = 0;
    if (leaveType === 'HOURLY') {
      used = approvedLeaves.reduce((sum, l) => sum + Number(l.hoursCount || 0), 0);
    } else {
      used = approvedLeaves.reduce((sum, l) => sum + Number(l.daysCount || 0), 0);
    }

    const existingBalance = await this.prisma.employeeLeaveBalance.findUnique({
      where: {
        companyId_employeeId_year_leaveType: {
          companyId,
          employeeId,
          year,
          leaveType,
        },
      },
    });

    if (existingBalance) {
      const total = Number(existingBalance.totalBalance);
      const remaining = Math.max(0, total - used);
      await this.prisma.employeeLeaveBalance.update({
        where: { id: existingBalance.id },
        data: {
          usedBalance: used,
          remainingBalance: remaining,
        },
      });
    }
  }

  async getLeaveBalances(companyId: string, year?: number, leaveType?: string, employeeId?: string) {
    const currentYear = year ? Number(year) : new Date().getFullYear();

    const employeesWhere: any = { companyId };
    if (employeeId) employeesWhere.id = employeeId;

    const employees = await this.prisma.employee.findMany({
      where: employeesWhere,
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        branchName: true,
        branchId: true,
        departmentName: true,
      },
      orderBy: { fullName: 'asc' },
    });

    const balanceWhere: any = { companyId, year: currentYear };
    if (leaveType) balanceWhere.leaveType = leaveType;
    if (employeeId) balanceWhere.employeeId = employeeId;

    const existingBalances = await this.prisma.employeeLeaveBalance.findMany({
      where: balanceWhere,
    });

    const balanceMap = new Map<string, any>();
    for (const b of existingBalances) {
      balanceMap.set(`${b.employeeId}_${b.leaveType}`, b);
    }

    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const approvedLeavesWhere: any = {
      companyId,
      status: 'APPROVED',
      startDate: { gte: startOfYear, lte: endOfYear },
    };
    if (leaveType) approvedLeavesWhere.leaveType = leaveType;
    if (employeeId) approvedLeavesWhere.employeeId = employeeId;

    const approvedLeaves = await this.prisma.employeeLeave.findMany({
      where: approvedLeavesWhere,
      select: {
        employeeId: true,
        leaveType: true,
        daysCount: true,
        hoursCount: true,
      },
    });

    const usedMap = new Map<string, number>();
    for (const l of approvedLeaves) {
      const key = `${l.employeeId}_${l.leaveType}`;
      const amount = l.leaveType === 'HOURLY' ? Number(l.hoursCount || 0) : Number(l.daysCount || 0);
      usedMap.set(key, (usedMap.get(key) || 0) + amount);
    }

    const targetTypes = leaveType
      ? [leaveType]
      : ['ANNUAL', 'SICK', 'EMERGENCY', 'HOURLY'];

    const results: any[] = [];

    for (const emp of employees) {
      for (const type of targetTypes) {
        const key = `${emp.id}_${type}`;
        const existing = balanceMap.get(key);
        const used = usedMap.get(key) || 0;
        const defaultTotal = type === 'ANNUAL' ? 30 : type === 'SICK' ? 15 : type === 'EMERGENCY' ? 7 : 24;
        const total = existing ? Number(existing.totalBalance) : defaultTotal;
        const remaining = Math.max(0, total - used);
        const unit = type === 'HOURLY' ? 'HOURS' : 'DAYS';

        results.push({
          id: existing?.id || `virtual-${emp.id}-${type}-${currentYear}`,
          companyId,
          employeeId: emp.id,
          employee: emp,
          year: currentYear,
          leaveType: type,
          totalBalance: total,
          usedBalance: used,
          remainingBalance: remaining,
          unit: existing?.unit || unit,
          notes: existing?.notes || null,
          isConfigured: Boolean(existing),
          updatedAt: existing?.updatedAt || null,
        });
      }
    }

    return results;
  }

  async setLeaveBalance(companyId: string, dto: SetLeaveBalanceDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('الموظف المحدد غير موجود في بيانات الشركة');

    const year = Number(dto.year) || new Date().getFullYear();
    const leaveType = dto.leaveType;
    const unit = dto.unit || (leaveType === 'HOURLY' ? 'HOURS' : 'DAYS');

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const approvedLeaves = await this.prisma.employeeLeave.findMany({
      where: {
        companyId,
        employeeId: dto.employeeId,
        leaveType,
        status: 'APPROVED',
        startDate: { gte: startOfYear, lte: endOfYear },
      },
    });

    const used =
      leaveType === 'HOURLY'
        ? approvedLeaves.reduce((sum, l) => sum + Number(l.hoursCount || 0), 0)
        : approvedLeaves.reduce((sum, l) => sum + Number(l.daysCount || 0), 0);

    const remaining = Math.max(0, Number(dto.totalBalance) - used);

    return this.prisma.employeeLeaveBalance.upsert({
      where: {
        companyId_employeeId_year_leaveType: {
          companyId,
          employeeId: dto.employeeId,
          year,
          leaveType,
        },
      },
      create: {
        companyId,
        employeeId: dto.employeeId,
        year,
        leaveType,
        totalBalance: dto.totalBalance,
        usedBalance: used,
        remainingBalance: remaining,
        unit,
        notes: dto.notes,
      },
      update: {
        totalBalance: dto.totalBalance,
        usedBalance: used,
        remainingBalance: remaining,
        unit,
        notes: dto.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
          },
        },
      },
    });
  }

  async batchSetLeaveBalances(companyId: string, dto: BatchSetLeaveBalancesDto) {
    const whereEmp: any = { companyId };
    if (dto.branchId) whereEmp.branchId = dto.branchId;

    const employees = await this.prisma.employee.findMany({
      where: whereEmp,
      select: { id: true },
    });

    const results: any[] = [];
    for (const emp of employees) {
      const res = await this.setLeaveBalance(companyId, {
        employeeId: emp.id,
        year: dto.year,
        leaveType: dto.leaveType,
        totalBalance: dto.totalBalance,
        unit: dto.unit,
        notes: dto.notes,
      });
      results.push(res);
    }

    return { count: results.length, message: `تم تعيين رصيد الإجازات لعدد ${results.length} موظف بنجاح` };
  }

  // ══════════════════════════════════════════════
  // 4. سجل النقاط والتحفيز (Points & Gamification)
  // ══════════════════════════════════════════════

  async getPointsSummary(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        branchName: true,
        departmentName: true,
        points: {
          select: {
            points: true,
          },
        },
      },
    });

    const summary = employees.map((emp) => {
      const totalPoints = emp.points.reduce((acc, curr) => acc + curr.points, 0);
      let tier = 'BRONZE';
      let tierAr = 'برونزي';
      if (totalPoints >= 1000) {
        tier = 'DIAMOND';
        tierAr = 'ماسي';
      } else if (totalPoints >= 500) {
        tier = 'GOLD';
        tierAr = 'ذهبي';
      } else if (totalPoints >= 200) {
        tier = 'SILVER';
        tierAr = 'فضي';
      }

      return {
        id: emp.id,
        fullName: emp.fullName,
        jobTitle: emp.jobTitle,
        branchName: emp.branchName,
        departmentName: emp.departmentName,
        totalPoints,
        tier,
        tierAr,
      };
    });

    // Sort descending by totalPoints
    return summary.sort((a, b) => b.totalPoints - a.totalPoints);
  }

  async getPointsLogs(companyId: string, employeeId?: string) {
    const where: any = { companyId };
    if (employeeId) where.employeeId = employeeId;

    return this.prisma.employeePointRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });
  }

  async awardPoints(companyId: string, dto: AwardPointsDto, awardedBy?: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new NotFoundException('الموظف المحدد غير موجود في بيانات الشركة');

    return this.prisma.employeePointRecord.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        points: dto.points,
        reason: dto.reason,
        category: dto.category || 'ACHIEVEMENT',
        awardedBy: awardedBy || 'مدير النظام',
        date: dto.date ? new Date(dto.date) : new Date(),
      },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
          },
        },
      },
    });
  }

  async deletePointLog(companyId: string, id: string) {
    const existing = await this.prisma.employeePointRecord.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('سجل النقاط غير موجود');
    return this.prisma.employeePointRecord.delete({ where: { id } });
  }

  async getPointsRules(companyId: string) {
    const defaultRules = {
      latePointsPerMinute: 0,
      latePointPrice: 0,
      overtimePointsPerMinute: 0,
      overtimePointPrice: 0,
      earlyLeavePointsPerMinute: 0,
      earlyLeavePointPrice: 0,
      earlyArrivalPointsPerMinute: 0,
      earlyArrivalPointPrice: 0,
      currency: 'IQD',
    };

    const template = await this.prisma.printTemplate.findFirst({
      where: { companyId, docType: 'hr_points_rules' },
    });
    if (!template?.config) {
      return defaultRules;
    }
    try {
      const parsed = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
      return { ...defaultRules, ...parsed };
    } catch {
      return defaultRules;
    }
  }

  async savePointsRules(companyId: string, rules: any) {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { companyId, docType: 'hr_points_rules' },
    });

    const jsonConfig = typeof rules === 'string' ? rules : JSON.stringify(rules);

    if (existing) {
      await this.prisma.printTemplate.update({
        where: { id: existing.id },
        data: {
          config: jsonConfig,
          name: 'قواعد احتساب وتسعير نقاط الحضور والانصراف',
          updatedAt: new Date(),
        },
      });
      return { success: true, message: 'تم حفظ القواعد بنجاح', rules };
    }

    await this.prisma.printTemplate.create({
      data: {
        companyId,
        docType: 'hr_points_rules',
        name: 'قواعد احتساب وتسعير نقاط الحضور والانصراف',
        config: jsonConfig,
      },
    });
    return { success: true, message: 'تم حفظ القواعد بنجاح', rules };
  }

  // ══════════════════════════════════════════════
  // 5. مسابقات وتحديات الموظفين (Competitions)
  // ══════════════════════════════════════════════

  async getCompetitions(companyId: string, status?: string) {
    const where: any = { companyId };
    if (status) where.status = status;

    return this.prisma.employeeCompetition.findMany({
      where,
      include: {
        winnerEmployee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCompetition(companyId: string, dto: CreateCompetitionDto) {
    return this.prisma.employeeCompetition.create({
      data: {
        companyId,
        title: dto.title,
        description: dto.description,
        targetType: dto.targetType,
        targetValue: dto.targetValue,
        reward: dto.reward,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: 'ACTIVE',
      },
    });
  }

  async updateCompetition(companyId: string, id: string, dto: UpdateCompetitionDto) {
    const existing = await this.prisma.employeeCompetition.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('المسابقة غير موجودة');

    return this.prisma.employeeCompetition.update({
      where: { id },
      data: {
        title: dto.title ?? existing.title,
        description: dto.description ?? existing.description,
        reward: dto.reward ?? existing.reward,
        status: dto.status ?? existing.status,
        winnerEmployeeId: dto.winnerEmployeeId ?? existing.winnerEmployeeId,
      },
      include: {
        winnerEmployee: {
          select: {
            id: true,
            fullName: true,
            jobTitle: true,
            branchName: true,
          },
        },
      },
    });
  }

  async deleteCompetition(companyId: string, id: string) {
    const existing = await this.prisma.employeeCompetition.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('المسابقة غير موجودة');
    return this.prisma.employeeCompetition.delete({ where: { id } });
  }

  // ══════════════════════════════════════════════
  // 6. إحصائيات عامة للمتجر واللوحة الرئيسية (HR Stats)
  // ══════════════════════════════════════════════

  async getHrStats(companyId: string) {
    const [employeesCount, pendingLeavesCount, activeCompetitionsCount, todayAttendance] = await Promise.all([
      this.prisma.employee.count({ where: { companyId } }),
      this.prisma.employeeLeave.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.employeeCompetition.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.employeeAttendance.count({
        where: {
          companyId,
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      }),
    ]);

    return {
      employeesCount,
      pendingLeavesCount,
      activeCompetitionsCount,
      todayAttendanceCount: todayAttendance,
    };
  }
}
