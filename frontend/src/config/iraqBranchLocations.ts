// Iraqi Branch City Locations
// Geographic coordinates sourced from verified reference data
// CRS: WGS84 / EPSG:4326 - Coordinates: [longitude, latitude]

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
    nameAr: 'بغداد',
    nameEn: 'Baghdad',
    longitude: 44.3661,
    latitude: 33.3152,
    isHeadOffice: true,
    code: 'BR-01',
    statusText: 'المركز الرئيسي — متصل',
    syncLabel: 'إدارة القيود المالية المجمعة',
  },
  {
    id: 'basra',
    nameAr: 'البصرة',
    nameEn: 'Basra',
    longitude: 47.7833,
    latitude: 30.5081,
    code: 'BR-02',
    statusText: 'مزامنة السندات المالية',
    syncLabel: 'تمت مزامنة سندات القبض',
  },
  {
    id: 'erbil',
    nameAr: 'أربيل',
    nameEn: 'Erbil',
    longitude: 44.0094,
    latitude: 36.1901,
    code: 'BR-03',
    statusText: 'ترحيل القيود اليومية',
    syncLabel: 'تمت مزامنة قيود التذاكر',
  },
  {
    id: 'mosul',
    nameAr: 'الموصل',
    nameEn: 'Mosul',
    longitude: 43.1300,
    latitude: 36.3400,
    code: 'BR-04',
    statusText: 'مزامنة العمليات',
    syncLabel: 'تحديث سجل الحركات المحاسبية',
  },
  {
    id: 'najaf',
    nameAr: 'النجف',
    nameEn: 'Najaf',
    longitude: 44.3292,
    latitude: 31.9961,
    code: 'BR-05',
    statusText: 'حجوزات الطيران',
    syncLabel: 'مزامنة مبيعات الفنادق والطيران',
  },
  {
    id: 'karbala',
    nameAr: 'كربلاء',
    nameEn: 'Karbala',
    longitude: 44.0244,
    latitude: 32.6160,
    code: 'BR-06',
    statusText: 'الأرصدة والمقبوضات',
    syncLabel: 'تمت مطابقة أرصدة الصندوق',
  },
  {
    id: 'kirkuk',
    nameAr: 'كركوك',
    nameEn: 'Kirkuk',
    longitude: 44.3922,
    latitude: 35.4681,
    code: 'BR-07',
    statusText: 'متابعة الأرصدة',
    syncLabel: 'تحديث كشف الحساب التجميعي',
  },
  {
    id: 'sulaymaniyah',
    nameAr: 'السليمانية',
    nameEn: 'Sulaymaniyah',
    longitude: 45.4329,
    latitude: 35.5570,
    code: 'BR-08',
    statusText: 'الحسابات الختامية',
    syncLabel: 'مزامنة حركة الحسابات',
  },
];
