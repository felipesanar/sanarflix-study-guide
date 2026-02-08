// Enterprise Journey Analytics Types

export interface JourneyFilters {
  dateRange: { start: Date; end: Date };
  iesId?: string;
  excludedIES?: string[];
}

// Executive Summary Types
export interface ExecutiveMetrics {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number; // DAU/MAU ratio
  avgSessionDepth: number;
  avgSessionDuration: number;
  timeToFirstSimulado: number | null; // days
  calendarAdoption: number; // percentage
  churnRiskCount: number;
  totalUsers: number;
}

// Funnel Types
export interface FunnelStage {
  id: string;
  name: string;
  shortName: string;
  count: number;
  percentage: number;
  dropoff: number;
  description: string;
}

export interface JourneyFunnelData {
  stages: FunnelStage[];
  totalUsers: number;
  conversionRate: number;
}

// Behavioral Segments
export interface BehavioralSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  color: string;
}

export interface BehavioralSegmentsData {
  segments: BehavioralSegment[];
  totalUsers: number;
}

// Retention Cohort
export interface CohortWeek {
  cohortDate: string;
  cohortLabel: string;
  initialUsers: number;
  weeks: {
    week: number;
    retained: number;
    percentage: number;
  }[];
}

export interface RetentionCohortData {
  cohorts: CohortWeek[];
  avgRetentionWeek1: number;
  avgRetentionWeek4: number;
}

// Learning Velocity
export interface AreaPerformance {
  area: string;
  accuracy: number;
  totalResponses: number;
  uniqueUsers: number;
  avgTimePerQuestion?: number;
}

export interface StudyCorrelation {
  studyHours: string;
  accuracy: number;
  userCount: number;
}

export interface LearningVelocityData {
  areaPerformance: AreaPerformance[];
  overallAccuracy: number;
  correlationData: StudyCorrelation[];
  gaps: { area: string; accuracy: number; improvement: string }[];
}

// Engagement Depth
export interface SessionDepthBucket {
  bucket: string;
  count: number;
  percentage: number;
}

export interface HourlyHeatmapCell {
  dayOfWeek: number;
  hour: number;
  value: number;
}

export interface EngagementDepthData {
  sessionDepth: SessionDepthBucket[];
  avgPagesPerSession: number;
  avgTimeOnPlatform: number;
  heatmap: HourlyHeatmapCell[];
  peakDay: string;
  peakHour: number;
}

// Smart Insights
export interface SmartInsight {
  id: string;
  type: 'anomaly' | 'opportunity' | 'risk' | 'correlation' | 'positive';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  metric?: string;
  value?: number;
  change?: number;
  action?: string;
  dataSource: string;
}

// Risk Alerts
export interface RiskAlert {
  id: string;
  level: 'critical' | 'warning' | 'positive';
  title: string;
  description: string;
  count?: number;
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
}

// Combined Journey Data
export interface JourneyAnalyticsData {
  executive: ExecutiveMetrics;
  funnel: JourneyFunnelData;
  segments: BehavioralSegmentsData;
  retention: RetentionCohortData;
  learning: LearningVelocityData;
  engagement: EngagementDepthData;
  insights: SmartInsight[];
  alerts: RiskAlert[];
  isLoading: boolean;
  error: Error | null;
}
