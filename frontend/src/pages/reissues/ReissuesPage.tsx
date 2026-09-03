import React from 'react';
import { ServiceListPage } from '../../components/services/ServiceListPage';

/** تغيير التذاكر — سجلّه ومحرّره مشتركان مع بقية الخدمات البسيطة. */
export const ReissuesPage: React.FC = () => <ServiceListPage kind="CHANGE" />;

export default ReissuesPage;
