import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { DiagnosticoDrillState } from './types';

interface DiagnosticoBreadcrumbProps {
  drill: DiagnosticoDrillState;
  simuladoNome?: string;
  onGoToAreas: () => void;
  onGoToEspecialidades: () => void;
}

/**
 * Breadcrumb dinâmico do diagnóstico curricular: Exame / Área / Especialidade.
 * O nível folha (tema) não aparece no breadcrumb — a lista de temas já indica
 * a especialidade selecionada no header do painel.
 */
export const DiagnosticoBreadcrumb: React.FC<DiagnosticoBreadcrumbProps> = ({
  drill,
  simuladoNome,
  onGoToAreas,
  onGoToEspecialidades,
}) => (
  <motion.div
    key={`${drill.level}-${drill.area?.name ?? ''}-${drill.especialidade?.name ?? ''}`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.2 }}
  >
    <Breadcrumb className="overflow-x-auto">
      <BreadcrumbList className="flex-nowrap whitespace-nowrap">
        <BreadcrumbItem>
          {drill.level === 'areas' ? (
            <BreadcrumbPage>{simuladoNome ?? 'Exame'}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink className="cursor-pointer" onClick={onGoToAreas}>
              {simuladoNome ?? 'Exame'}
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {drill.area && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {drill.level === 'especialidades' ? (
                <BreadcrumbPage>{drill.area.name}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="cursor-pointer" onClick={onGoToEspecialidades}>
                  {drill.area.name}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </>
        )}
        {drill.especialidade && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{drill.especialidade.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  </motion.div>
);
