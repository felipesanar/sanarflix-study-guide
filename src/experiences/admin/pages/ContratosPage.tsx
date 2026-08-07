import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { ContratoSimuladosBoard } from '@/components/admin/contratos/ContratoSimuladosBoard';

/**
 * Seção "Contratos & cronograma" do Portal do Admin (`/admin/contratos`) —
 * spec §6.3. É onde o CX/cadastros declara quantos simulados a IES tem
 * direito, cria os slots, vincula cada slot a um simulado e marca modalidade
 * e datas. Sem isso o cronograma do gestor nasce vazio.
 */
const ContratosPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader
      title="Contratos & cronograma"
      subtitle="Quantos simulados cada IES tem direito, quais slots já têm simulado vinculado e as datas de cada um. Alimenta o cronograma do Portal do Gestor."
    />
    <ContratoSimuladosBoard />
  </div>
);

export default ContratosPage;
