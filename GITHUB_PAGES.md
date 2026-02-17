# GitHub Pagesで公開ダッシュボードを使う

## 目的
- `pc-server` のローカルDBから、**GPS/生レコードを含まない公開用JSON**を生成する
- GitHub Pages (`docs/`) で静的ダッシュボード表示する

## 1. 公開用JSONを生成
PowerShell:
```powershell
cd C:\Users\senta\.openclaw\workspace\projects\health-connect-sync\pc-server
python export_public_summary.py
```

PowerShellスクリプト版:
```powershell
.\export-public-summary.ps1
```

出力先（既定）:
- `../docs/data/summary.json`

日付を相対表記ではなくISOで出したい場合:
```powershell
python export_public_summary.py --keep-dates
```

## 2. ローカル確認
`docs/index.html` は `docs/data/summary.json` を読むだけの静的ページです。

簡易確認:
```powershell
cd C:\Users\senta\.openclaw\workspace\projects\health-connect-sync
python -m http.server 8000
```

ブラウザ:
- `http://localhost:8000/docs/`

## 3. GitHubへ反映
```powershell
cd C:\Users\senta\.openclaw\workspace\projects\health-connect-sync
git add docs/index.html docs/data/summary.json pc-server/export_public_summary.py pc-server/export-public-summary.ps1 GITHUB_PAGES.md
git commit -m "Add anonymized summary export and GitHub Pages dashboard"
git push
```

## 4. Pages設定
GitHubリポジトリ設定:
- `Settings` -> `Pages`
- `Build and deployment` -> `Deploy from a branch`
- Branch: `main` / Folder: `/docs`

反映後URL:
- `https://<your-account>.github.io/<repo>/`

## セキュリティ注意
- コミットしてよいのは `docs/data/summary.json` のみ（公開用）
- `pc-server/hc_sync.db`, `.env`, 生payloadはコミットしない
- さらに匿名性を上げたい場合は `--keep-dates` を使わず、既定の相対日付（`D-6` 等）で公開する
