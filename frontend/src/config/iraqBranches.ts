export interface IraqiBranchCity {
  id: string;
  nameAr: string;
  nameEn: string;
  longitude: number;
  latitude: number;
  isHeadOffice?: boolean;
  code: string;
  statusText: string;
  syncLabel: string;
}

export const IRAQ_BRANCH_CITIES: IraqiBranchCity[] = [
  {
    id: 'baghdad',
    nameAr: 'بغداد (المركز الرئيسي)',
    nameEn: 'Baghdad (Headquarters)',
    longitude: 44.3661,
    latitude: 33.3152,
    isHeadOffice: true,
    code: 'BR-01',
    statusText: 'متصل • المركز الرئيسي',
    syncLabel: 'إدارة وتأكيد القيود المالية',
  },
  {
    id: 'basra',
    nameAr: 'فرع البصرة',
    nameEn: 'Basra Branch',
    longitude: 47.7833,
    latitude: 30.5081,
    code: 'BR-02',
    statusText: 'مزامنة السندات المالية',
    syncLabel: 'تمت مزامنة سندات القبض',
  },
  {
    id: 'erbil',
    nameAr: 'فرع أربيل',
    nameEn: 'Erbil Branch',
    longitude: 44.0094,
    latitude: 36.1901,
    code: 'BR-03',
    statusText: 'ترحيل القيود اليومية',
    syncLabel: 'تمت مزامنة قيود التذاكر',
  },
  {
    id: 'karbala',
    nameAr: 'فرع كربلاء المقدسة',
    nameEn: 'Karbala Branch',
    longitude: 44.0244,
    latitude: 32.6160,
    code: 'BR-04',
    statusText: 'الأرصدة والمقبوضات',
    syncLabel: 'تمت مطابقة أرصدة الصندوق',
  },
  {
    id: 'najaf',
    nameAr: 'فرع النجف الأشرف',
    nameEn: 'Najaf Branch',
    longitude: 44.3333,
    latitude: 31.9961,
    code: 'BR-05',
    statusText: 'حجوزات الطيران',
    syncLabel: 'مزامنة مبيعات الفنادق والطيران',
  },
  {
    id: 'mosul',
    nameAr: 'فرع الموصل',
    nameEn: 'Mosul Branch',
    longitude: 43.1300,
    latitude: 36.3400,
    code: 'BR-06',
    statusText: 'مزامنة العمليات',
    syncLabel: 'تحديث سجل الحركات المحاسبية',
  },
  {
    id: 'sulaymaniyah',
    nameAr: 'فرع السليمانية',
    nameEn: 'Sulaymaniyah Branch',
    longitude: 45.4329,
    latitude: 35.5570,
    code: 'BR-07',
    statusText: 'الحسابات الختامية',
    syncLabel: 'مزامنة حركة الحسابات',
  },
  {
    id: 'kirkuk',
    nameAr: 'فرع كركوك',
    nameEn: 'Kirkuk Branch',
    longitude: 44.3922,
    latitude: 35.4681,
    code: 'BR-08',
    statusText: 'متابعة الأرصدة',
    syncLabel: 'تحديث كشف الحساب التجميعي',
  },
];
