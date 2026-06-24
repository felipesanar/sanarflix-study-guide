import * as React from 'react';
import { PageWrapper } from '@/components/PageWrapper';

interface Props {
  loadingMessage?: string;
  waitForData?: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

/** Casca padrão de uma página roteável dentro de uma experiência. */
export const ExperiencePage: React.FC<Props> = ({ children, ...rest }) => (
  <PageWrapper waitForData {...rest}>
    {children}
  </PageWrapper>
);
