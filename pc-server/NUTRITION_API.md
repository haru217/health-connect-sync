# 手入力：食事/サプリ API

## POST /api/nutrition/log
ヘッダ：`X-Api-Key: <API_KEY>`

### 単発（エイリアス）
```json
{"alias":"protein","count":1}
```

### 単発（自由記述＋PFC＋微量栄養素）
```json
{
  "label":"白米",
  "count":1,
  "kcal":300,
  "protein_g":6,
  "fat_g":1,
  "carbs_g":70,
  "micros": {"sodium_mg": 0}
}
```

### 過去日の追記（夜にまとめて書く用）
```json
{"alias":"protein", "count":1, "local_date":"2026-02-18"}
```

### 複数
```json
{
  "items": [
    {"alias":"protein","count":1},
    {"alias":"vitamin_d","count":1},
    {"alias":"multivitamin","count":1}
  ]
}
```

## GET /api/nutrition/day?date=YYYY-MM-DD
ヘッダ：`X-Api-Key: <API_KEY>`

## GET /api/report/yesterday
ヘッダ：`X-Api-Key: <API_KEY>`

レスポンス：
```json
{"text":"..."}
```
