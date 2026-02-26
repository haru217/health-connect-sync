# CEO Dashboard Update Guide

Use this when updating task status in `ops/CEO_DASHBOARD.html` without UI clicks.

## Update one task

```powershell
.\ops\update-ceo-dashboard-task.ps1 -TaskId I2-GEMINI -Status in_progress -Actor Gemini
```

Status values:
- `todo`
- `in_progress`
- `blocked`
- `done`

## Stamp behavior
- `done` -> `Actor @ yyyy-MM-dd HH:mm`
- `in_progress` -> `Actor (進行中)`
- `blocked` -> `Actor (blocked)`
- `todo` -> `—`

## Add a new CEO task
1. Copy an existing `<div class="leaf"...>` line in `ops/CEO_DASHBOARD.html`.
2. Set a unique `data-id`.
3. Set `data-track="iter"` if it should count in top KPI.
4. Set `data-default` to initial status.
5. Set `Primary Owner` in `<small>`.
