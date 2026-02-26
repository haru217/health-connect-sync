# Workflow (No Chaos Mode)

## Request lifecycle
1. **仕様策定**（Claude）:
   - CEOと壁打ちして要件を確定する
   - 仕様書を `docs/v3/` に作成する
   - タスクを `requests/<agent>/YYYYMMDD-<topic>.md` に作成する
2. **着手**（担当エージェント）:
   - リクエストファイルに owner + status を記入する
3. **実装**（Codex-1 or Codex-2）:
   - スコープをリクエストの完了条件に限定する
4. **コミット**（Codex）:
   - 動作確認が取れたら即 `git commit`
   - タスク1件 = 1コミット以上。複数タスクをまとめない
   - コミットメッセージ形式: `<種別>(<担当>): <要約>`（例: `feat(Codex-2): /api/home-summary 実装`）
5. **レビュー**（Codex-3）:
   - 実装後にコードレビューを実施する
   - 指摘があれば修正 → 再コミット
6. **ハンドオフ**:
   - `handoff/incoming/YYYYMMDD-<agent>-<topic>.md` を作成する
7. **クローズ**:
   - ハンドオフを `handoff/done/` に移動する
   - リクエストをクローズする
8. **ダッシュボード更新**（全員）:
   - ステータスが `done` または `blocked` になったら更新する
   - `ops/update-ceo-dashboard-task.ps1` を使う

## Status labels
- `todo`
- `in_progress`
- `blocked`
- `done`

## Conflict prevention rules
- One request file per deliverable.
- No parallel edits to the same acceptance criteria without explicit assignment.
- If blocked > 30 min, post handoff with blocker and stop.
