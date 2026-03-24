/**
 * StudyGuideImportTab Component
 * Tab for importing study guide data in admin portal
 */

import * as React from 'react';
import { StudyGuideImportWizard } from './study-guide-import';
import { StudyGuideOverview } from './study-guide-import/components/StudyGuideOverview';
import { Separator } from '@/components/ui/separator';

export const StudyGuideImportTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <StudyGuideOverview />
      <Separator />
      <StudyGuideImportWizard />
    </div>
  );
};
