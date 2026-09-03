import React from 'react';
import { ServiceListPage } from '../../components/services/ServiceListPage';

/**
 * حجوزات الفنادق.
 *
 * كانت الصفحة تقرأ من hotelsApi وهي دوال ترمي استثناءً «غير مربوطة بقاعدة
 * البيانات»، فلا تعرض شيئاً ولا تحفظ شيئاً. صارت تحفظ تذكرةً موسومة HOTEL،
 * فتدخل الكشوف والتقارير والقيود مثل بقية الخدمات.
 */
export const HotelsPage: React.FC = () => <ServiceListPage kind="HOTEL" />;

export default HotelsPage;
