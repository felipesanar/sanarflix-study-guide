import * as React from 'react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

/** Shell do Portal do Gestor v2 (spec §8.3). */
export const GestorShell: React.FC = () => (
  <div className="min-h-screen bg-background">
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Outlet />
    </Suspense>
  </div>
);
