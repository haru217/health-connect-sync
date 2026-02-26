# Common First Read (All Agents)

## Always do first
1. Read `ops/START_HERE.md`
2. Find request in `requests/<agent>/`
3. Confirm acceptance criteria before edits

## Delivery discipline
- Put results in `handoff/incoming/` using `ops/templates/handoff.md`.
- Update `ops/WORKLOG.md`.
- Keep output scoped to request acceptance criteria.

## Git commit rules (CTO指定)
コミットのタイミングは以下の単位で行う。指揮はCTO（Claude）が持つ。

**Codexの必須コミットタイミング：**
1. タスク1件完了時（`requests/codex/` の1ファイル = 1コミット以上）
2. 動作確認が取れた時点で即コミット（未確認のまま次のタスクに進まない）
3. ハンドオフを書く前にコミットを完了させる

**コミットメッセージ形式：**
```
<種別>(<担当>): <変更の要約>

例:
feat(Codex-2): /api/home-summary を cloudflare-api に実装
fix(Codex-1): HomeScreen の充足度バーのナビゲーション修正
review(Codex-3): I5-CODEX レビュー指摘を反映
```

**禁止事項：**
- 複数タスクをまとめて1コミットにしない
- 動作未確認のコードをコミットしない
- `.env` やシークレットをコミットしない

## Anti-chaos rules
- Do not create ad-hoc top-level docs.
- Do not use personal notes as project source of truth.
- If priorities conflict, stop and request CEO decision.
- Keep Japanese text files in UTF-8 and avoid full-file rewrites; prefer minimal `apply_patch` edits to prevent mojibake.
