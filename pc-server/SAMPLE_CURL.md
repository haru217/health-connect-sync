# 疎通テスト（PCサーバ）

PCサーバ起動後、ローカルで手動POSTして動作確認する。

## /api/status
```bash
curl -H "X-Api-Key: <API_KEY>" http://localhost:8765/api/status
```

## /api/sync（最小）
```bash
curl -X POST http://localhost:8765/api/sync \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <API_KEY>" \
  -d '{
    "deviceId":"dev_test",
    "syncId":"00000000-0000-0000-0000-000000000001",
    "syncedAt":"2026-02-17T00:00:00Z",
    "rangeStart":"2026-02-16T00:00:00Z",
    "rangeEnd":"2026-02-17T00:00:00Z",
    "records":[
      {
        "type":"WeightRecord",
        "time":"2026-02-17T00:00:00Z",
        "payload": {"weight": {"inKilograms": 75.0}}
      },
      {
        "type":"StepsRecord",
        "startTime":"2026-02-16T00:00:00Z",
        "endTime":"2026-02-16T23:59:59Z",
        "payload": {"count": 8000}
      }
    ]
  }'
```

その後：
- `http://localhost:8765/ui`
- `http://localhost:8765/api/summary`（ヘッダ必須）

## /api/intake（摂取カロリー入力）
```bash
curl -X POST http://localhost:8765/api/intake \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <API_KEY>" \
  -d '{
    "day":"2026-02-17",
    "intakeKcal": 1800,
    "source":"openclaw"
  }'
```
