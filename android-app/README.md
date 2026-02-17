# Android Studioプロジェクト雛形

場所: `projects/health-connect-sync/android-app`

目的
- Health Connect から「全部読む」
- PCローカルサーバへ `POST /api/sync`
- PCサーバのUDP discoveryで baseUrl を自動入力（IP知らなくてもOK）

注意
- Health Connect SDKやCompose/Gradleのバージョンは環境で調整が必要な場合あり（まずはビルド通すところから）
