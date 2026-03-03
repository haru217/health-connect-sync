import type {
  CatalogItem,
  ExerciseFreqType,
  ExerciseIntensityType,
  ExerciseType,
  ReportType,
  SexType,
  WeightGoalType,
} from './types'

export const REPORT_TYPES: readonly ReportType[] = ['daily', 'weekly', 'monthly'] as const
export const PROFILE_USER_ID = 'default'
export const WEIGHT_GOAL_VALUES: readonly WeightGoalType[] = ['lose', 'gain', 'maintain'] as const
export const EXERCISE_FREQ_VALUES: readonly ExerciseFreqType[] = ['none', 'weekly12', 'weekly35', 'daily'] as const
export const EXERCISE_TYPE_VALUES: readonly ExerciseType[] = ['walk', 'gym', 'run', 'bodyweight', 'none'] as const
export const EXERCISE_INTENSITY_VALUES: readonly ExerciseIntensityType[] = ['light', 'moderate', 'high'] as const
export const GENDER_VALUES: readonly SexType[] = ['male', 'female', 'other'] as const
export const USER_PROFILE_PATCH_KEYS = new Set([
  'age',
  'gender',
  'height_cm',
  'goal_weight_kg',
  'sleep_goal_minutes',
  'steps_goal',
  'weight_goal',
  'bp_goal_systolic',
  'bp_goal_diastolic',
  'lens_weight',
  'lens_bp',
  'lens_sleep',
  'lens_performance',
  'exercise_freq',
  'exercise_type',
  'exercise_intensity',
])
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const CURSOR_REPAIR_SAFETY_MS = 5 * 60 * 1000
export const MILLIS_PER_DAY = 24 * 60 * 60 * 1000
export const DETAILED_RETENTION_DAYS = 14
export const MIN_VALID_BMR_KCAL_PER_DAY = 600
export const MAX_VALID_BMR_KCAL_PER_DAY = 4500
export const PRUNABLE_RECORD_TYPES = [
  'StepsRecord',
  'DistanceRecord',
  'SpeedRecord',
  'ActivityIntensityRecord',
  'ActiveCaloriesBurnedRecord',
  'TotalCaloriesBurnedRecord',
] as const
export const HEALTH_CONNECT_REQUIRED_PERMISSIONS = [
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_WEIGHT',
  'android.permission.health.READ_SLEEP',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_SPEED',
  'android.permission.health.READ_RESTING_HEART_RATE',
  'android.permission.health.READ_BLOOD_PRESSURE',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_BODY_TEMPERATURE',
  'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  'android.permission.health.READ_BASAL_METABOLIC_RATE',
  'android.permission.health.READ_HEIGHT',
  'android.permission.health.READ_BODY_FAT',
] as const
export const DEFAULT_BASELINE_SCORE: Readonly<Record<'sleep' | 'activity' | 'nutrition' | 'condition', number>> = {
  sleep: 70,
  activity: 60,
  nutrition: 75,
  condition: 73,
}
export const DEFAULT_BMR_KCAL = 1500
export const DEFAULT_LLM_PROVIDER = 'anthropic'
export const DEFAULT_LLM_MODEL = 'claude-haiku-4-5-20251001'
export const LLM_TIMEOUT_MS = 120_000
export const REPORT_EMOJI_RE = /\p{Extended_Pictographic}/gu
export const RECORD_PERMISSION_MAP: Readonly<Record<string, (typeof HEALTH_CONNECT_REQUIRED_PERMISSIONS)[number]>> = {
  StepsRecord: 'android.permission.health.READ_STEPS',
  WeightRecord: 'android.permission.health.READ_WEIGHT',
  SleepSessionRecord: 'android.permission.health.READ_SLEEP',
  HeartRateRecord: 'android.permission.health.READ_HEART_RATE',
  ExerciseSessionRecord: 'android.permission.health.READ_EXERCISE',
  ActiveCaloriesBurnedRecord: 'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  DistanceRecord: 'android.permission.health.READ_DISTANCE',
  TotalCaloriesBurnedRecord: 'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  SpeedRecord: 'android.permission.health.READ_SPEED',
  RestingHeartRateRecord: 'android.permission.health.READ_RESTING_HEART_RATE',
  BloodPressureRecord: 'android.permission.health.READ_BLOOD_PRESSURE',
  OxygenSaturationRecord: 'android.permission.health.READ_OXYGEN_SATURATION',
  BodyTemperatureRecord: 'android.permission.health.READ_BODY_TEMPERATURE',
  BasalBodyTemperatureRecord: 'android.permission.health.READ_BASAL_BODY_TEMPERATURE',
  BasalMetabolicRateRecord: 'android.permission.health.READ_BASAL_METABOLIC_RATE',
  HeightRecord: 'android.permission.health.READ_HEIGHT',
  BodyFatRecord: 'android.permission.health.READ_BODY_FAT',
}
export const RECORD_TYPE_META_PREFIX = '__meta__'
export const LAST_AGGREGATED_AT_MS_KEY = `${RECORD_TYPE_META_PREFIX}last_aggregated_at_ms`
export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type, X-Api-Key, X-Seed-Token',
}

export const SUPPLEMENT_CATALOG: Readonly<Record<string, CatalogItem>> = {
  protein: {
    alias: 'protein',
    label: '\u30df\u30eb\u30af\u30d7\u30ed\u30c6\u30a4\u30f3',
    kcal: 107,
    protein_g: 20,
    fat_g: 0,
    carbs_g: 6.8,
    unit: '\u672c',
  },
  vitamin_d: {
    alias: 'vitamin_d',
    label: '\u30d3\u30bf\u30df\u30f3D',
    kcal: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    unit: '\u9320',
    micros: { vitamin_d3_mcg: 50 },
  },
  multivitamin: {
    alias: 'multivitamin',
    label: '\u30de\u30eb\u30c1\u30d3\u30bf\u30df\u30f3',
    kcal: 3.36,
    protein_g: 0.1,
    fat_g: 0.1,
    carbs_g: 0.656,
    unit: '\u9320',
    micros: {
      calcium_mg: 200,
      magnesium_mg: 100,
      zinc_mg: 6,
      vitamin_c_mg: 125,
      vitamin_e_mg: 9,
      folate_mcg: 240,
    },
  },
  fish_oil: {
    alias: 'fish_oil',
    label: '\u30d5\u30a3\u30c3\u30b7\u30e5\u30aa\u30a4\u30eb',
    kcal: 8.34,
    protein_g: 0.222,
    fat_g: 0.791,
    carbs_g: 0.1,
    unit: '\u9320',
    micros: { omega3_mg: 270 },
  },
}
