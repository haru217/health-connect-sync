export interface InsightItem {
  level: string
  message: string
}

export interface StepsByDateItem {
  date: string
  steps: number
}

export interface DistanceKmByDateItem {
  date: string
  km: number
}

export interface WeightByDateItem {
  date: string
  kg: number
}

export interface CaloriesByDateItem {
  date: string
  kcal: number
}

export interface SleepHoursByDateItem {
  date: string
  hours: number
}

export interface HeartRateByDateItem {
  date: string
  bpm: number
}

export interface OxygenSaturationByDateItem {
  date: string
  pct: number
}

export interface BodyFatByDateItem {
  date: string
  pct: number
}

export interface BodyFatPercentageItem {
  date: string
  percentage: number
}

export interface BloodPressureByDateItem {
  date: string
  systolic: number
  diastolic: number
}

export interface ExerciseSessionItem {
  date: string
  exerciseType: number
  title?: string | null
  durationMinutes?: number | null
  startTime?: string | null
}

export interface DietSummary {
  trend: string
  ma7Delta7d?: number | null
  estimatedDeficitKcalPerDay?: number | null
}

export interface SummaryResponse {
  totalRecords: number
  byType: Record<string, number>
  stepsByDate: StepsByDateItem[]
  distanceKmByDate: DistanceKmByDateItem[]
  weightByDate: WeightByDateItem[]
  weightDaily: WeightByDateItem[]
  activeCaloriesByDate: CaloriesByDateItem[]
  totalCaloriesByDate: CaloriesByDateItem[]
  intakeCaloriesByDate: CaloriesByDateItem[]
  calorieBalanceByDate: CaloriesByDateItem[]
  sleepMinutesByDate: Array<{ date: string; minutes: number }>
  sleepHoursByDate: SleepHoursByDateItem[]
  speedKmhByDate: Array<{ date: string; kmh: number }>
  heartRateBpmByDate: HeartRateByDateItem[]
  restingHeartRateBpmByDate: HeartRateByDateItem[]
  oxygenSaturationPctByDate: OxygenSaturationByDateItem[]
  basalMetabolicRateKcalByDate: Array<{ date: string; kcalPerDay: number; measured?: boolean }>
  bodyFatPctByDate: BodyFatByDateItem[]
  bodyFatByDate?: BodyFatPercentageItem[]
  heightM?: number | null
  bmrByDate?: Array<{ date: string; kcalPerDay: number }>
  bloodPressureByDate?: BloodPressureByDateItem[]
  restingHeartRateByDate?: HeartRateByDateItem[]
  oxygenSaturationByDate?: BodyFatPercentageItem[]
  distanceByDate?: Array<{ date: string; meters: number }>
  activeCalByDate?: CaloriesByDateItem[]
  totalCalByDate?: CaloriesByDateItem[]
  exerciseSessions?: ExerciseSessionItem[]
  diet: DietSummary | null
  insights: InsightItem[]
}

export interface NutritionEvent {
  id: number
  consumed_at: string
  local_date: string
  alias: string | null
  label: string
  count: number
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

export interface NutritionDayResponse {
  date: string
  events: NutritionEvent[]
  totals: {
    kcal: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
    micros: Record<string, number>
  }
}

export interface SupplementItem {
  alias: string
  label: string
  kcal: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

export interface SupplementsResponse {
  supplements: SupplementItem[]
}

export interface NutrientTargetItem {
  key: string
  name: string
  unit: string
  target: number
  actual: number | null
  status: 'green' | 'yellow' | 'red'
  rule?: 'min' | 'max' | 'range'
}

export interface NutrientTargetsResponse {
  targets: NutrientTargetItem[]
}

export interface ProfileResponse {
  name?: string
  height_cm?: number
  birth_year?: number
  sex?: 'male' | 'female' | 'other'
  goal_weight_kg?: number
  sleep_goal_minutes?: number
  steps_goal?: number
}

export type ReportType = 'daily' | 'weekly' | 'monthly'

export interface ReportListItem {
  id: number
  report_date: string
  report_type: ReportType
  created_at: string
  preview: string
}

export interface ReportsListResponse {
  reports: ReportListItem[]
}

export interface ReportDetailResponse {
  id: number
  report_date: string
  report_type: ReportType
  prompt_used: string
  content: string
  created_at: string
}

export interface PromptResponse {
  type: ReportType
  prompt: string
}

export interface SaveReportRequest {
  report_date: string
  report_type: ReportType
  prompt_used: string
  content: string
}

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string }

export interface HomeEvidence {
  type: string
  label: string
  value: string
  tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
  innerTab?: string
}

export type HomeStatusKey = 'sleep' | 'steps' | 'meal' | 'weight' | 'bp'
export type HomeStatusTone = 'normal' | 'warning' | 'critical'

export interface HomeStatusItem {
  key: HomeStatusKey
  label: string
  value: string | null
  ok: boolean
  tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
  innerTab?: 'composition' | 'vital' | 'sleep'
  tone?: HomeStatusTone
  progress?: number
}

export type AttentionSeverity = 'critical' | 'warning' | 'info' | 'positive'
export type AttentionCategory = 'threshold' | 'trend' | 'achievement'

export interface AttentionPoint {
  id: string
  icon: 'warning' | 'down' | 'up' | 'check' | 'alert'
  message: string
  severity: AttentionSeverity
  category: AttentionCategory
  navigateTo: {
    tab: 'home' | 'health' | 'exercise' | 'meal' | 'my'
    subTab?: 'composition' | 'vital' | 'sleep'
  }
  dataSource: string
}

export interface PreviousReportLink {
  date: string
  created_at: string
}

export interface HomeSufficiency {
  sleep: boolean
  steps: boolean
  weight: boolean
  meal: boolean
  bp?: boolean
}

export interface HomeSummaryResponse {
  date: string
  report: { content: string; created_at: string } | null
  sufficiency: HomeSufficiency
  evidences?: HomeEvidence[]
  statusItems?: HomeStatusItem[]
  attentionPoints?: AttentionPoint[]
  previousReport?: PreviousReportLink | null
}

export interface HealthConnectPermissionStatus {
  source: string
  required: string[]
  granted: string[]
  missing: string[]
  required_count: number
  granted_count: number
  is_fully_granted: boolean
  updated_at: string | null
}

export interface ConnectionStatusResponse {
  last_sync_at: string | null
  total_records: number
  has_weight_data: boolean
  has_sleep_data: boolean
  has_activity_data: boolean
  has_vitals_data: boolean
  health_connect_permissions?: HealthConnectPermissionStatus
}

// ── /api/body-data ──
export interface BodyDataPoint {
  date: string
  weight_kg: number | null
  body_fat_pct: number | null
  bmr_kcal: number | null
}

export interface BodyDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    weight_kg: number | null
    body_fat_pct: number | null
    bmi: number | null
    bmr_kcal: number | null
  }
  goalWeight: number | null
  series: BodyDataPoint[]
  periodSummary: {
    avg_weight_kg: number | null
    avg_body_fat_pct: number | null
    avg_bmi: number | null
    points: number
  }
}

// ── /api/sleep-data ──
export interface SleepDataPoint {
  date: string
  sleep_minutes: number | null
  deep_min: number | null
  light_min: number | null
  rem_min: number | null
}

export interface SleepDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    sleep_minutes: number | null
    bedtime: string | null
    wake_time: string | null
    avg_spo2: number | null
    min_spo2: number | null
  }
  stages: {
    deep_min: number | null
    light_min: number | null
    rem_min: number | null
  }
  series: SleepDataPoint[]
  periodSummary: {
    avg_sleep_min: number | null
    goal_days: number
    measured_days?: number
    goal_rate?: number | null
    avg_deep_min?: number | null
    avg_light_min?: number | null
    avg_rem_min?: number | null
    deep_ratio?: number | null
    light_ratio?: number | null
    rem_ratio?: number | null
    avg_spo2?: number | null
    min_spo2?: number | null
  }
}

// ── /api/vitals-data ──
export interface VitalsDataPoint {
  date: string
  systolic: number | null
  diastolic: number | null
  resting_hr: number | null
}

export interface VitalsDataResponse {
  baseDate: string
  period: 'week' | 'month' | 'year'
  current: {
    systolic: number | null
    diastolic: number | null
    resting_hr: number | null
  }
  series: VitalsDataPoint[]
  periodSummary: {
    avg_systolic: number | null
    avg_diastolic: number | null
    avg_resting_hr: number | null
    high_bp_points: number
  }
}
