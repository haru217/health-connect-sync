# gcloud インストール（Windows）

このPCには現状 `gcloud` が入っていないので、デプロイ前にインストールが必要。

## 手順
1) Google Cloud SDK をインストール
- 公式: https://cloud.google.com/sdk/docs/install

2) PowerShell を開き、確認
```powershell
gcloud --version
```

3) ログイン
```powershell
gcloud auth login
```

4) （ローカル実行テストをするなら）ADCも作る
```powershell
gcloud auth application-default login
```
