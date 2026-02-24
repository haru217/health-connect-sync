# UTF-8 baseline

This repository now enforces UTF-8 defaults to reduce mojibake:

- `.editorconfig` uses `charset = utf-8`.
- `.gitattributes` normalizes text files and keeps binaries untouched.
- `automation/enable_utf8_env.ps1` forces UTF-8 console and Python env.

## Manual bootstrap (optional)

Run this once in a PowerShell session before ad-hoc scripts:

```powershell
. C:\Users\user\health-connect-sync\automation\enable_utf8_env.ps1
```

## Notes

- `cmd.exe` pipelines are still more likely to corrupt Japanese text.
- Prefer PowerShell + Python UTF-8 (`PYTHONUTF8=1`) for data import scripts.
