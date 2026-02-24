-- Keep one latest row per logical Health Connect identity for records with record_id.
DELETE FROM health_records
WHERE record_id IS NOT NULL
  AND rowid NOT IN (
    SELECT MAX(rowid)
    FROM health_records
    WHERE record_id IS NOT NULL
    GROUP BY type, COALESCE(source, ''), record_id
  );

-- Normalize keys to device-independent canonical key.
UPDATE health_records
SET record_key = 'rid2|' || type || '|' || COALESCE(source, '') || '|' || record_id
WHERE record_id IS NOT NULL;

-- Force aggregate rebuild on next /api/summary request.
DELETE FROM record_type_counts
WHERE record_type = '__meta__last_aggregated_at_ms';

