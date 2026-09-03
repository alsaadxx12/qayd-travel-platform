import React from 'react';
import { ServiceListPage } from '../../components/services/ServiceListPage';

/** بيع الوزن — الوزن الإضافي المباع للمسافرين. */
export const BaggagePage: React.FC = () => <ServiceListPage kind="BAGGAGE" />;

export default BaggagePage;
