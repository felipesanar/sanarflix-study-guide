import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '@/features/mentor/api/queries';

export function SoModalidade({ b2c, b2b, children }: { b2c?: boolean; b2b?: boolean; children: ReactNode }) {
  const { data } = useMe();
  const modalidade = data?.mentor.modalidade;
  return (modalidade === 'b2c' && b2c) || (modalidade === 'b2b' && b2b)
    ? <>{children}</>
    : <Navigate to="/mentor" replace />;
}
