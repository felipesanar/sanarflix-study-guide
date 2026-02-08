import React from 'react';
import { motion } from 'framer-motion';
import {
  ExecutiveSummaryCards,
  JourneyFunnelChart,
  BehavioralSegments,
  RetentionCohortGrid,
  LearningVelocityCard,
  EngagementDepthCard,
  SmartInsightsEngine,
  RiskAlertBanner,
  useJourneyAnalytics,
} from './journey';

export interface StudentJourneySectionProps {
  filters: {
    dateRange: { start: Date; end: Date };
    iesId?: string;
    excludedIES?: string[];
  };
}

export const StudentJourneySection: React.FC<StudentJourneySectionProps> = ({ filters }) => {
  const {
    executive,
    funnel,
    segments,
    retention,
    learning,
    engagement,
    insights,
    alerts,
    isLoading,
  } = useJourneyAnalytics(filters);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Risk Alerts Banner - Top priority */}
      <RiskAlertBanner alerts={alerts} isLoading={isLoading} />

      {/* Executive Summary KPIs */}
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Resumo Executivo
        </h3>
        <ExecutiveSummaryCards metrics={executive} isLoading={isLoading} />
      </section>

      {/* Journey Funnel & Behavioral Segments */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <JourneyFunnelChart data={funnel} isLoading={isLoading} />
        <BehavioralSegments data={segments} isLoading={isLoading} />
      </section>

      {/* Retention Cohort Grid */}
      <section>
        <RetentionCohortGrid data={retention} isLoading={isLoading} />
      </section>

      {/* Learning Velocity & Engagement Depth */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LearningVelocityCard data={learning} isLoading={isLoading} />
        <EngagementDepthCard data={engagement} isLoading={isLoading} />
      </section>

      {/* Smart Insights Engine */}
      <section>
        <SmartInsightsEngine insights={insights} isLoading={isLoading} />
      </section>
    </motion.div>
  );
};
