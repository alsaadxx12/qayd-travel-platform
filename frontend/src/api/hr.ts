import { apiRequest } from './client';

// ── Salaries Interfaces ──
export interface SalaryItem {
  id: string;
  companyId: string;
  employeeId: string;
  month: string;
  baseSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paymentMethod?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    branchName?: string;
    departmentName?: string;
    assignedCashbox?: string;
  };
}

export interface CreateSalaryPayload {
  employeeId: string;
  month: string;
  baseSalary: number;
  allowances?: number;
  bonuses?: number;
  deductions?: number;
  currency?: string;
  notes?: string;
}

export interface UpdateSalaryPayload {
  baseSalary?: number;
  allowances?: number;
  bonuses?: number;
  deductions?: number;
  status?: 'PENDING' | 'APPROVED' | 'PAID';
  paymentMethod?: string;
  notes?: string;
}

// ── Attendance Interfaces ──
export interface AttendanceItem {
  id: string;
  companyId: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'ON_LEAVE';
  lateMinutes: number;
  overtimeHours: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    branchName?: string;
    departmentName?: string;
    trustedDeviceId?: string | null;
    deviceModel?: string | null;
  };
}

export interface CreateAttendancePayload {
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'ON_LEAVE';
  lateMinutes?: number;
  overtimeHours?: number;
  latitude?: number;
  longitude?: number;
  deviceId?: string;
  deviceModel?: string;
  devicePlatform?: string;
  attestationType?: string;
  notes?: string;
}

export interface UpdateAttendancePayload {
  checkIn?: string;
  checkOut?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'ON_LEAVE';
  lateMinutes?: number;
  overtimeHours?: number;
  notes?: string;
}

// ── Leaves Interfaces ──
export interface LeaveItem {
  id: string;
  companyId: string;
  employeeId: string;
  leaveType: 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'HOURLY' | 'UNPAID' | 'OTHER';
  startDate: string;
  endDate: string;
  daysCount: number;
  hoursCount?: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  actionDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    branchName?: string;
    departmentName?: string;
  };
}

export interface CreateLeavePayload {
  employeeId: string;
  leaveType: 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'HOURLY' | 'UNPAID' | 'OTHER';
  startDate: string;
  endDate: string;
  daysCount?: number;
  hoursCount?: number;
  reason?: string;
  notes?: string;
}

export interface LeaveBalanceItem {
  id: string;
  companyId: string;
  employeeId: string;
  year: number;
  leaveType: 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'HOURLY';
  totalBalance: number;
  usedBalance: number;
  remainingBalance: number;
  unit: 'DAYS' | 'HOURS';
  notes?: string | null;
  isConfigured?: boolean;
  updatedAt?: string | null;
  employee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    branchName?: string;
    branchId?: string;
    departmentName?: string;
  };
}

export interface SetLeaveBalancePayload {
  employeeId: string;
  year: number;
  leaveType: 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'HOURLY';
  totalBalance: number;
  unit?: 'DAYS' | 'HOURS';
  notes?: string;
}

export interface BatchSetLeaveBalancesPayload {
  branchId?: string;
  year: number;
  leaveType: 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'HOURLY';
  totalBalance: number;
  unit?: 'DAYS' | 'HOURS';
  notes?: string;
}

// ── Points Interfaces ──
export interface PointSummaryItem {
  id: string;
  fullName: string;
  jobTitle?: string;
  branchName?: string;
  departmentName?: string;
  totalPoints: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
  tierAr: string;
}

export interface PointLogItem {
  id: string;
  companyId: string;
  employeeId: string;
  points: number;
  reason: string;
  category: string;
  awardedBy?: string;
  date: string;
  createdAt: string;
  employee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    branchName?: string;
  };
}

export interface AwardPointsPayload {
  employeeId: string;
  points: number;
  reason: string;
  category?: string;
  date?: string;
}

export interface PointsRulesConfig {
  latePointsPerMinute: number;       // كم نقطة خصم لكل دقيقة تأخير
  latePointPrice: number;            // كم سعر نقطة الخصم
  overtimePointsPerMinute: number;   // كم نقطة لكل دقيقة إضافية
  overtimePointPrice: number;        // كم سعر الدقيقة الإضافية
  earlyLeavePointsPerMinute: number; // كم يخصم عن الخروج قبل الدوام لكل دقيقة
  earlyLeavePointPrice: number;      // تسعير الخروج قبل الدوام
  earlyArrivalPointsPerMinute: number; // كم يضاف عند الحضور المبكر لكل دقيقة
  earlyArrivalPointPrice: number;    // تسعير الحضور المبكر
  currency?: string;
}

// ── Competitions Interfaces ──
export interface CompetitionItem {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  targetType: 'SALES_VOLUME' | 'TICKETS_COUNT' | 'ATTENDANCE_STREAK' | 'POINTS_EARNED';
  targetValue: number;
  reward: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  winnerEmployeeId?: string;
  createdAt: string;
  updatedAt: string;
  winnerEmployee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    branchName?: string;
  };
}

export interface CreateCompetitionPayload {
  title: string;
  description?: string;
  targetType: 'SALES_VOLUME' | 'TICKETS_COUNT' | 'ATTENDANCE_STREAK' | 'POINTS_EARNED';
  targetValue: number;
  reward: string;
  startDate: string;
  endDate: string;
}

export interface UpdateCompetitionPayload {
  title?: string;
  description?: string;
  reward?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  winnerEmployeeId?: string;
}

// ── Overall Stats Interface ──
export interface HrStats {
  employeesCount: number;
  pendingLeavesCount: number;
  activeCompetitionsCount: number;
  todayAttendanceCount: number;
}

// ── HR API Client ──
export const hrApi = {
  // Stats
  getStats: async (): Promise<HrStats> => {
    return apiRequest<HrStats>('/api/hr/stats');
  },

  // Salaries
  getSalaries: async (params?: { month?: string; employeeId?: string; status?: string }): Promise<SalaryItem[]> => {
    const q = new URLSearchParams();
    if (params?.month) q.set('month', params.month);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return apiRequest<SalaryItem[]>(`/api/hr/salaries${qs ? `?${qs}` : ''}`);
  },

  createSalary: async (data: CreateSalaryPayload): Promise<SalaryItem> => {
    return apiRequest<SalaryItem>('/api/hr/salaries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSalary: async (id: string, data: UpdateSalaryPayload): Promise<SalaryItem> => {
    return apiRequest<SalaryItem>(`/api/hr/salaries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteSalary: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/hr/salaries/${id}`, {
      method: 'DELETE',
    });
  },

  // Attendance
  getAttendance: async (params?: { date?: string; employeeId?: string }): Promise<AttendanceItem[]> => {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    const qs = q.toString();
    return apiRequest<AttendanceItem[]>(`/api/hr/attendance${qs ? `?${qs}` : ''}`);
  },

  recordAttendance: async (data: CreateAttendancePayload): Promise<AttendanceItem> => {
    return apiRequest<AttendanceItem>('/api/hr/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAttendance: async (id: string, data: UpdateAttendancePayload): Promise<AttendanceItem> => {
    return apiRequest<AttendanceItem>(`/api/hr/attendance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteAttendance: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/hr/attendance/${id}`, {
      method: 'DELETE',
    });
  },

  // Leaves
  getLeaves: async (params?: { status?: string; employeeId?: string; leaveType?: string }): Promise<LeaveItem[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.leaveType) q.set('leaveType', params.leaveType);
    const qs = q.toString();
    return apiRequest<LeaveItem[]>(`/api/hr/leaves${qs ? `?${qs}` : ''}`);
  },

  createLeave: async (data: CreateLeavePayload): Promise<LeaveItem> => {
    return apiRequest<LeaveItem>('/api/hr/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateLeaveStatus: async (id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', notes?: string): Promise<LeaveItem> => {
    return apiRequest<LeaveItem>(`/api/hr/leaves/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  deleteLeave: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/hr/leaves/${id}`, {
      method: 'DELETE',
    });
  },

  // Leave Balances
  getLeaveBalances: async (params?: { year?: number; leaveType?: string; employeeId?: string }): Promise<LeaveBalanceItem[]> => {
    const q = new URLSearchParams();
    if (params?.year) q.set('year', String(params.year));
    if (params?.leaveType) q.set('leaveType', params.leaveType);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    const qs = q.toString();
    return apiRequest<LeaveBalanceItem[]>(`/api/hr/leaves/balances${qs ? `?${qs}` : ''}`);
  },

  setLeaveBalance: async (data: SetLeaveBalancePayload): Promise<LeaveBalanceItem> => {
    return apiRequest<LeaveBalanceItem>('/api/hr/leaves/balances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  batchSetLeaveBalances: async (data: BatchSetLeaveBalancesPayload): Promise<{ count: number; message: string }> => {
    return apiRequest<{ count: number; message: string }>('/api/hr/leaves/balances/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Points
  getPointsSummary: async (): Promise<PointSummaryItem[]> => {
    return apiRequest<PointSummaryItem[]>('/api/hr/points/summary');
  },

  getPointsLogs: async (employeeId?: string): Promise<PointLogItem[]> => {
    const qs = employeeId ? `?employeeId=${employeeId}` : '';
    return apiRequest<PointLogItem[]>(`/api/hr/points/logs${qs}`);
  },

  awardPoints: async (data: AwardPointsPayload): Promise<PointLogItem> => {
    return apiRequest<PointLogItem>('/api/hr/points/award', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deletePointLog: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/hr/points/logs/${id}`, {
      method: 'DELETE',
    });
  },

  getPointsRules: async (): Promise<PointsRulesConfig> => {
    return apiRequest<PointsRulesConfig>('/api/hr/points/rules');
  },

  savePointsRules: async (data: PointsRulesConfig): Promise<any> => {
    return apiRequest<any>('/api/hr/points/rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Competitions
  getCompetitions: async (status?: string): Promise<CompetitionItem[]> => {
    const qs = status ? `?status=${status}` : '';
    return apiRequest<CompetitionItem[]>(`/api/hr/competitions${qs}`);
  },

  createCompetition: async (data: CreateCompetitionPayload): Promise<CompetitionItem> => {
    return apiRequest<CompetitionItem>('/api/hr/competitions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCompetition: async (id: string, data: UpdateCompetitionPayload): Promise<CompetitionItem> => {
    return apiRequest<CompetitionItem>(`/api/hr/competitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteCompetition: async (id: string): Promise<void> => {
    return apiRequest<void>(`/api/hr/competitions/${id}`, {
      method: 'DELETE',
    });
  },
};
