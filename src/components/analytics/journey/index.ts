// Journey Analytics Components - Enterprise Edition (B2B Context)
export { ExecutiveSummaryCards } from './ExecutiveSummaryCards';
export { JourneyFunnelChart } from './JourneyFunnelChart';
export { BehavioralSegments } from './BehavioralSegments';
export { RetentionCohortGrid } from './RetentionCohortGrid';
export { StudyCorrelationCard } from './StudyCorrelationCard';
export { EngagementDepthCard } from './EngagementDepthCard';
export { SmartInsightsEngine } from './SmartInsightsEngine';
export { EngagementAlertBanner, RiskAlertBanner } from './RiskAlertBanner';

// Legacy export for backward compatibility
export { StudyCorrelationCard as LearningVelocityCard } from './StudyCorrelationCard';

// Hooks
export { useJourneyAnalytics } from './hooks/useJourneyAnalytics';

// Types
export type * from './types';
