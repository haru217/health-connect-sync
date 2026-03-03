import type { Env } from '../types'
import { jsonResponse, queryFirst } from '../utils'
import { getHealthConnectPermissionStatus } from './health'

export async function handleStatus(env: Env): Promise<Response> {
  const row = await queryFirst<{ total: number }>(env.DB, 'SELECT COUNT(*) AS total FROM health_records')
  return jsonResponse({
    ok: true,
    totalRecords: row?.total ?? 0,
    db: 'cloudflare-d1',
  })
}

export async function handleConnectionStatus(env: Env): Promise<Response> {
  const lastSync = await queryFirst<{ received_at: string }>(
    env.DB,
    'SELECT received_at FROM sync_runs ORDER BY received_at DESC LIMIT 1',
  )
  const total = await queryFirst<{ c: number }>(env.DB, 'SELECT COUNT(*) AS c FROM health_records')
  const weight = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type='WeightRecord' LIMIT 1",
  )
  const sleep = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type='SleepSessionRecord' LIMIT 1",
  )
  const activity = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type='StepsRecord' LIMIT 1",
  )
  const vitals = await queryFirst<{ c: number }>(
    env.DB,
    "SELECT COUNT(*) AS c FROM health_records WHERE type IN ('BloodPressureRecord','RestingHeartRateRecord') LIMIT 1",
  )
  const permissions = await getHealthConnectPermissionStatus(env.DB)

  return jsonResponse({
    last_sync_at: lastSync?.received_at ?? null,
    total_records: total?.c ?? 0,
    has_weight_data: (weight?.c ?? 0) > 0,
    has_sleep_data: (sleep?.c ?? 0) > 0,
    has_activity_data: (activity?.c ?? 0) > 0,
    has_vitals_data: (vitals?.c ?? 0) > 0,
    health_connect_permissions: permissions,
  })
}
