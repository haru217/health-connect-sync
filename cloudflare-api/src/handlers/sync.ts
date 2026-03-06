import { CURSOR_REPAIR_SAFETY_MS, HEALTH_CONNECT_REQUIRED_PERMISSIONS, RECORD_PERMISSION_MAP } from '../constants'
import type { Env, ExecutionContext, SyncRecordInput, SyncRequestInput } from '../types'
import { clampCursorMillisForRepair, execute, isSmokeDeviceId, jsonResponse, normalizeStringArray, nowIso, parseBooleanFlag, parseIsoToMillis, queryFirst, readJsonBody, shiftIsoDateByDays, toIsoDate } from '../utils'
import { computeRecordKey, stableStringify } from './sync-parsers'
import { generateDailyReportIfNeeded } from './report'
import { rebuildAggregatesFromHealthRecords } from './sync-aggregate'

export function parseSyncRequestPayload(payload: Record<string, unknown>): SyncRequestInput {
  const deviceId = typeof payload.deviceId === 'string' ? payload.deviceId.trim() : ''
  const syncId = typeof payload.syncId === 'string' ? payload.syncId.trim() : ''
  const syncedAt = typeof payload.syncedAt === 'string' ? payload.syncedAt.trim() : ''
  const rangeStart = typeof payload.rangeStart === 'string' ? payload.rangeStart.trim() : ''
  const rangeEnd = typeof payload.rangeEnd === 'string' ? payload.rangeEnd.trim() : ''
  const rawRecords = payload.records
  const requiredPermissions = normalizeStringArray(payload.requiredPermissions)
  const grantedPermissions = normalizeStringArray(payload.grantedPermissions)

  if (!deviceId || !syncId || !syncedAt || !rangeStart || !rangeEnd) {
    throw new Error('deviceId, syncId, syncedAt, rangeStart, rangeEnd are required')
  }
  if (!Array.isArray(rawRecords)) {
    throw new Error('records must be an array')
  }

  const records: SyncRecordInput[] = rawRecords.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('record must be an object')
    }
    const row = item as Record<string, unknown>
    const type = typeof row.type === 'string' ? row.type.trim() : ''
    if (!type) {
      throw new Error('record.type is required')
    }
    return {
      type,
      recordId: typeof row.recordId === 'string' ? row.recordId : undefined,
      recordKey: typeof row.recordKey === 'string' ? row.recordKey : undefined,
      source: typeof row.source === 'string' ? row.source : undefined,
      startTime: typeof row.startTime === 'string' ? row.startTime : undefined,
      endTime: typeof row.endTime === 'string' ? row.endTime : undefined,
      time: typeof row.time === 'string' ? row.time : undefined,
      lastModifiedTime: typeof row.lastModifiedTime === 'string' ? row.lastModifiedTime : undefined,
      unit: typeof row.unit === 'string' ? row.unit : undefined,
      payload: row.payload ?? {},
    }
  })

  return {
    deviceId,
    syncId,
    syncedAt,
    rangeStart,
    rangeEnd,
    records,
    requiredPermissions,
    grantedPermissions,
  }
}

export async function handleSync(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const payload = parseSyncRequestPayload(await readJsonBody(request))
  let upserted = 0
  let skipped = 0
  const receivedAt = nowIso()

  await execute(
    env.DB,
    `
    INSERT OR IGNORE INTO sync_runs(
      sync_id, device_id, synced_at, range_start, range_end, received_at, record_count
    ) VALUES(?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.syncId,
      payload.deviceId,
      payload.syncedAt,
      payload.rangeStart,
      payload.rangeEnd,
      receivedAt,
      payload.records.length,
    ],
  )

  const requiredPermissions =
    payload.requiredPermissions && payload.requiredPermissions.length > 0
      ? payload.requiredPermissions
      : [...HEALTH_CONNECT_REQUIRED_PERMISSIONS]
  const grantedPermissions = payload.grantedPermissions ?? []
  if (requiredPermissions.length > 0 || grantedPermissions.length > 0) {
    await execute(
      env.DB,
      `
      INSERT INTO sync_permission_snapshots(
        sync_id, device_id, synced_at, received_at, required_permissions_json, granted_permissions_json
      ) VALUES(?, ?, ?, ?, ?, ?)
      ON CONFLICT(sync_id) DO UPDATE SET
        device_id = excluded.device_id,
        synced_at = excluded.synced_at,
        received_at = excluded.received_at,
        required_permissions_json = excluded.required_permissions_json,
        granted_permissions_json = excluded.granted_permissions_json
      `,
      [
        payload.syncId,
        payload.deviceId,
        payload.syncedAt,
        receivedAt,
        JSON.stringify(requiredPermissions),
        JSON.stringify(grantedPermissions),
      ],
    )
  }

  for (const record of payload.records) {
    try {
      const recordKey = await computeRecordKey(payload.deviceId, record)
      const source = record.source?.trim() || null
      const payloadJson = stableStringify(record.payload ?? {})
      await execute(
        env.DB,
        `
        INSERT INTO health_records(
          record_key, device_id, type, record_id, source, start_time, end_time, time,
          last_modified_time, unit, payload_json, ingested_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(record_key) DO UPDATE SET
          device_id = excluded.device_id,
          type = excluded.type,
          record_id = excluded.record_id,
          source = excluded.source,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          time = excluded.time,
          last_modified_time = excluded.last_modified_time,
          unit = excluded.unit,
          payload_json = excluded.payload_json,
          ingested_at = excluded.ingested_at
        `,
        [
          recordKey,
          payload.deviceId,
          record.type,
          record.recordId ?? null,
          source,
          record.startTime ?? null,
          record.endTime ?? null,
          record.time ?? null,
          record.lastModifiedTime ?? null,
          record.unit ?? null,
          payloadJson,
          receivedAt,
        ],
      )
      upserted += 1
    } catch {
      skipped += 1
    }
  }

  await execute(
    env.DB,
    'UPDATE sync_runs SET upserted_count = ?, skipped_count = ? WHERE sync_id = ?',
    [upserted, skipped, payload.syncId],
  )

  const rangeEndMs = parseIsoToMillis(payload.rangeEnd)
  if (rangeEndMs != null && !isSmokeDeviceId(payload.deviceId)) {
    const cursorRow = await queryFirst<{ last_range_end: string | null }>(
      env.DB,
      'SELECT last_range_end FROM sync_cursor_state WHERE id = 1',
    )
    const currentMs = parseIsoToMillis(cursorRow?.last_range_end ?? null) ?? 0
    if (rangeEndMs >= currentMs) {
      await execute(
        env.DB,
        `
        INSERT INTO sync_cursor_state(id, last_range_end, updated_at, last_sync_id, last_device_id)
        VALUES(1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          last_range_end = excluded.last_range_end,
          updated_at = excluded.updated_at,
          last_sync_id = excluded.last_sync_id,
          last_device_id = excluded.last_device_id
        `,
        [payload.rangeEnd, nowIso(), payload.syncId, payload.deviceId],
      )
    }
  }

  const today = toIsoDate(new Date())
  const llmApiKey = (env.LLM_API_KEY ?? '').trim()
  if (ctx) {
    ctx.waitUntil(
      rebuildAggregatesFromHealthRecords(env.DB)
        .then(() => {
          if (llmApiKey) {
            return generateDailyReportIfNeeded(env, today)
          }
        })
        .catch((err: unknown) =>
          console.error('Post-sync background tasks failed:', err)
        ),
    )
  }

  return jsonResponse({
    accepted: true,
    upsertedCount: upserted,
    skippedCount: skipped,
  })
}

export async function handleSyncCursor(url: URL, env: Env): Promise<Response> {
  const rawDeviceId = url.searchParams.get('deviceId') ?? ''
  const deviceId = rawDeviceId.trim()
  if (!deviceId) {
    return jsonResponse({ detail: 'deviceId query is required' }, 400)
  }

  const state = await queryFirst<{
    last_range_end: string | null
    updated_at: string | null
    last_sync_id: string | null
    last_device_id: string | null
  }>(
    env.DB,
    `
    SELECT last_range_end, updated_at, last_sync_id, last_device_id
    FROM sync_cursor_state
    WHERE id = 1
    `,
  )

  const fallbackByDevice = await queryFirst<{ range_end: string | null; synced_at: string | null; received_at: string | null }>(
    env.DB,
    `
    SELECT range_end, synced_at, received_at
    FROM sync_runs
    WHERE device_id = ? AND lower(device_id) NOT LIKE '%smoke%'
    ORDER BY range_end DESC, received_at DESC
    LIMIT 1
    `,
    [deviceId],
  )

  const fallbackGlobal = await queryFirst<{ range_end: string | null; synced_at: string | null; received_at: string | null }>(
    env.DB,
    `
    SELECT range_end, synced_at, received_at
    FROM sync_runs
    WHERE lower(device_id) NOT LIKE '%smoke%'
    ORDER BY range_end DESC, received_at DESC
    LIMIT 1
    `,
  )

  const rawRangeEnd = state?.last_range_end ?? fallbackByDevice?.range_end ?? fallbackGlobal?.range_end ?? null
  const parsedMs = parseIsoToMillis(rawRangeEnd)
  const clampedMs = parsedMs == null ? null : clampCursorMillisForRepair(parsedMs)
  const rangeEnd = clampedMs == null ? null : new Date(clampedMs).toISOString()
  const wasClamped = parsedMs != null && clampedMs != null && clampedMs !== parsedMs
  const source = state?.last_range_end
    ? 'cursor_state'
    : fallbackByDevice?.range_end
      ? 'sync_runs_device'
      : fallbackGlobal?.range_end
        ? 'sync_runs_global'
        : 'none'

  return jsonResponse({
    deviceId,
    source,
    found: !!rangeEnd,
    rangeEnd,
    rawRangeEnd,
    wasClamped,
    syncedAt: fallbackByDevice?.synced_at ?? fallbackGlobal?.synced_at ?? null,
    receivedAt: fallbackByDevice?.received_at ?? fallbackGlobal?.received_at ?? null,
    updatedAt: state?.updated_at ?? null,
    lastDeviceId: state?.last_device_id ?? null,
  })
}


