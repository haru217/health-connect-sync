import { EXERCISE_FREQ_VALUES, EXERCISE_INTENSITY_VALUES, EXERCISE_TYPE_VALUES, GENDER_VALUES, PROFILE_USER_ID, USER_PROFILE_PATCH_KEYS, WEIGHT_GOAL_VALUES } from '../constants'
import type { D1Database, Env, UserProfileRow } from '../types'
import { ValidationError, execute, hasOwn, jsonResponse, normalizeLensFlag, nowIso, queryFirst, readJsonBody, sanitizeUserProfileRow, toValidatedEnum, toValidatedInteger, toValidatedNumber } from '../utils'

export async function getUserProfile(db: D1Database): Promise<UserProfileRow> {
  const row = await queryFirst<UserProfileRow>(
    db,
    `
    SELECT
      user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal,
      weight_goal, bp_goal_systolic, bp_goal_diastolic,
      lens_weight, lens_bp, lens_sleep, lens_performance,
      exercise_freq, exercise_type, exercise_intensity,
      created_at, updated_at
    FROM user_profiles
    WHERE user_id = ?
    `,
    [PROFILE_USER_ID],
  )
  return sanitizeUserProfileRow(row)
}

export function applyUserProfilePatch(base: UserProfileRow, payload: Record<string, unknown>): UserProfileRow {
  const unknownKeys = Object.keys(payload).filter((key) => !USER_PROFILE_PATCH_KEYS.has(key))
  if (unknownKeys.length > 0) {
    throw new ValidationError(`Unknown fields: ${unknownKeys.join(', ')}`)
  }

  const next: UserProfileRow = {
    ...base,
    user_id: PROFILE_USER_ID,
  }

  if (hasOwn(payload, 'age')) {
    next.age = payload.age == null ? null : toValidatedInteger(payload.age, 'age', 0, 130)
  }
  if (hasOwn(payload, 'gender')) {
    next.gender = payload.gender == null ? null : toValidatedEnum(payload.gender, 'gender', GENDER_VALUES)
  }
  if (hasOwn(payload, 'height_cm')) {
    next.height_cm = payload.height_cm == null ? null : toValidatedNumber(payload.height_cm, 'height_cm', 80, 250)
  }
  if (hasOwn(payload, 'goal_weight_kg')) {
    next.goal_weight_kg =
      payload.goal_weight_kg == null
        ? null
        : toValidatedNumber(payload.goal_weight_kg, 'goal_weight_kg', 20, 300)
  }
  if (hasOwn(payload, 'sleep_goal_minutes')) {
    next.sleep_goal_minutes =
      payload.sleep_goal_minutes == null
        ? 420
        : toValidatedInteger(payload.sleep_goal_minutes, 'sleep_goal_minutes', 180, 900)
  }
  if (hasOwn(payload, 'steps_goal')) {
    next.steps_goal =
      payload.steps_goal == null
        ? 8000
        : toValidatedInteger(payload.steps_goal, 'steps_goal', 1000, 50000)
  }
  if (hasOwn(payload, 'weight_goal')) {
    next.weight_goal =
      payload.weight_goal == null
        ? null
        : toValidatedEnum(payload.weight_goal, 'weight_goal', WEIGHT_GOAL_VALUES)
  }
  if (hasOwn(payload, 'bp_goal_systolic')) {
    next.bp_goal_systolic =
      payload.bp_goal_systolic == null
        ? null
        : toValidatedInteger(payload.bp_goal_systolic, 'bp_goal_systolic', 70, 250)
  }
  if (hasOwn(payload, 'bp_goal_diastolic')) {
    next.bp_goal_diastolic =
      payload.bp_goal_diastolic == null
        ? null
        : toValidatedInteger(payload.bp_goal_diastolic, 'bp_goal_diastolic', 40, 150)
  }
  if (hasOwn(payload, 'lens_weight')) {
    const flag = normalizeLensFlag(payload.lens_weight)
    if (flag == null) {
      throw new ValidationError('lens_weight must be 0 or 1')
    }
    next.lens_weight = flag
  }
  if (hasOwn(payload, 'lens_bp')) {
    const flag = normalizeLensFlag(payload.lens_bp)
    if (flag == null) {
      throw new ValidationError('lens_bp must be 0 or 1')
    }
    next.lens_bp = flag
  }
  if (hasOwn(payload, 'lens_sleep')) {
    const flag = normalizeLensFlag(payload.lens_sleep)
    if (flag == null) {
      throw new ValidationError('lens_sleep must be 0 or 1')
    }
    next.lens_sleep = flag
  }
  if (hasOwn(payload, 'lens_performance')) {
    const flag = normalizeLensFlag(payload.lens_performance)
    if (flag == null) {
      throw new ValidationError('lens_performance must be 0 or 1')
    }
    next.lens_performance = flag
  }
  if (hasOwn(payload, 'exercise_freq')) {
    next.exercise_freq =
      payload.exercise_freq == null
        ? null
        : toValidatedEnum(payload.exercise_freq, 'exercise_freq', EXERCISE_FREQ_VALUES)
  }
  if (hasOwn(payload, 'exercise_type')) {
    next.exercise_type =
      payload.exercise_type == null
        ? null
        : toValidatedEnum(payload.exercise_type, 'exercise_type', EXERCISE_TYPE_VALUES)
  }
  if (hasOwn(payload, 'exercise_intensity')) {
    next.exercise_intensity =
      payload.exercise_intensity == null
        ? null
        : toValidatedEnum(payload.exercise_intensity, 'exercise_intensity', EXERCISE_INTENSITY_VALUES)
  }

  if (
    next.bp_goal_systolic != null &&
    next.bp_goal_diastolic != null &&
    next.bp_goal_diastolic >= next.bp_goal_systolic
  ) {
    throw new ValidationError('bp_goal_diastolic must be lower than bp_goal_systolic')
  }

  return next
}

export async function upsertUserProfile(db: D1Database, payload: Record<string, unknown>): Promise<UserProfileRow> {
  const current = await getUserProfile(db)
  const next = applyUserProfilePatch(current, payload)
  const timestamp = nowIso()

  await execute(
    db,
    `
    INSERT INTO user_profiles(
      user_id, age, gender, height_cm, goal_weight_kg, sleep_goal_minutes, steps_goal,
      weight_goal, bp_goal_systolic, bp_goal_diastolic,
      lens_weight, lens_bp, lens_sleep, lens_performance,
      exercise_freq, exercise_type, exercise_intensity, updated_at
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      age = excluded.age,
      gender = excluded.gender,
      height_cm = excluded.height_cm,
      goal_weight_kg = excluded.goal_weight_kg,
      sleep_goal_minutes = excluded.sleep_goal_minutes,
      steps_goal = excluded.steps_goal,
      weight_goal = excluded.weight_goal,
      bp_goal_systolic = excluded.bp_goal_systolic,
      bp_goal_diastolic = excluded.bp_goal_diastolic,
      lens_weight = excluded.lens_weight,
      lens_bp = excluded.lens_bp,
      lens_sleep = excluded.lens_sleep,
      lens_performance = excluded.lens_performance,
      exercise_freq = excluded.exercise_freq,
      exercise_type = excluded.exercise_type,
      exercise_intensity = excluded.exercise_intensity,
      updated_at = excluded.updated_at
    `,
    [
      PROFILE_USER_ID,
      next.age,
      next.gender,
      next.height_cm,
      next.goal_weight_kg,
      next.sleep_goal_minutes,
      next.steps_goal,
      next.weight_goal,
      next.bp_goal_systolic,
      next.bp_goal_diastolic,
      next.lens_weight,
      next.lens_bp,
      next.lens_sleep,
      next.lens_performance,
      next.exercise_freq,
      next.exercise_type,
      next.exercise_intensity,
      timestamp,
    ],
  )

  return getUserProfile(db)
}


export async function handleProfileGet(env: Env): Promise<Response> {
  return jsonResponse(await getUserProfile(env.DB))
}

export async function handleProfilePut(request: Request, env: Env): Promise<Response> {
  let payload: Record<string, unknown>
  try {
    payload = await readJsonBody(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request body'
    return jsonResponse({ detail: message }, 400)
  }
  try {
    return jsonResponse(await upsertUserProfile(env.DB, payload))
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ detail: error.message }, 400)
    }
    throw error
  }
}
