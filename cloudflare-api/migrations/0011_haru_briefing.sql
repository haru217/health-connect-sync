ALTER TABLE ai_reports ADD COLUMN briefing TEXT;
ALTER TABLE daily_reports ADD COLUMN briefing TEXT;

-- H1 date model correction (one-time migration for mislabeled records)
DELETE FROM daily_reports WHERE date = '2026-03-03';
UPDATE daily_reports SET date = '2026-03-03' WHERE date = '2026-03-04';

