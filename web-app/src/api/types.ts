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
