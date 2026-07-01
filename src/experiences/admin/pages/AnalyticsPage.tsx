import * as React from 'react';
import Analytics from '@/pages/Analytics';

/**
 * Seção Analytics do Portal do Admin (`/admin/analytics`).
 *
 * Reusa a página de Analytics existente. Obs.: a `Analytics` traz o próprio
 * container/cabeçalho de página — o ajuste fino de layout dentro do AdminLayout
 * (ex.: evitar cabeçalho/largura duplicados) será feito ao plugar as rotas (F2·10).
 */
const AnalyticsPage: React.FC = () => <Analytics />;

export default AnalyticsPage;
