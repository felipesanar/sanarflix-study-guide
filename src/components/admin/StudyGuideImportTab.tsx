/**
 * StudyGuideImportTab Component
 * Tab for importing study guide data in admin portal
 */

import * as React from 'react';
import { StudyGuideImportWizard } from './study-guide-import';

export const StudyGuideImportTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <StudyGuideImportWizard />
    </div>
  );
};
