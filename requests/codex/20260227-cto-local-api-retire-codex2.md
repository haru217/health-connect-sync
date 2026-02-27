# タスク依頼: android-app URL制御 + API Key セキュリティ対処

- 日付: 2026-02-27
- 依頼者: Claude (CTO)
- 担当: Codex-2
- 優先度: 高（セキュリティ問題含む）
- 参照: `requests/shared/20260227-cto-direction-local-api-retirement.md`

## 背景

CTO決裁に基づき、`android-app` の以下2点を対処する。

## タスク 1: 本番ビルドでURL任意入力UIを非表示化

**対象ファイル**: `android-app/app/src/main/java/com/haru/hcsyncbridge/ui/settings/SettingsScreen.kt`

**方針** (C案): `BuildConfig.DEBUG` が `false` の場合、サーバーURL入力フィールドを非表示にする。

```kotlin
// 例: SettingsScreen の URL 入力欄を DEBUG のみ表示
if (BuildConfig.DEBUG) {
    // URL入力フィールド
}
```

デフォルトURL（`SettingsStore.DEFAULT_SERVER_BASE_URL`）は Cloudflare URL のまま維持する。

## タスク 2: DEFAULT_API_KEY のハードコード除去

**対象ファイル**: `android-app/app/src/main/java/com/haru/hcsyncbridge/settings/SettingsStore.kt`

**現状の問題**:
```kotlin
const val DEFAULT_API_KEY: String = "test12345"  // ← セキュリティリスク
```

**対処方針**:
- `local.properties` または `build.gradle` の `BuildConfig` フィールドから注入する
- `local.properties` に `api.key=実際のキー` を追加し `.gitignore` に記載済みかを確認する
- `DEFAULT_API_KEY` のフォールバックは空文字 `""` にする（アプリ起動時に未設定エラーとして検出できるようにする）

## タスク 3: android-app UI文言の旧PC server 案内を削除

**対象**: `SettingsScreen.kt` 等のユーザー向けUIラベル・説明文で `PC server` / `localhost:8765` / `ローカルサーバー` 等の記述があれば削除または `Cloudflare API` 向けの説明に更新する。

## 完了条件

- [ ] 本番ビルド（`release` variant）でURL入力フィールドが非表示になる
- [ ] `DEFAULT_API_KEY = "test12345"` がコードから消えている
- [ ] `local.properties` が `.gitignore` に記載されている
- [ ] SettingsScreen の文言に旧PC server 案内がない
- [ ] handoff に完了ノートを書く
- [ ] WORKLOG.md を更新する
