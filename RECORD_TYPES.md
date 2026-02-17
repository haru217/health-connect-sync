# Health Connect Record Types（取得対象一覧 / Draft）

方針：**MVPでは取得可能なRecord typeは全て読む**。
ただしHealth Connect SDKは「全部」を指定するAPIが無いので、アプリ側で Record class を列挙して
- 権限要求
- 取得クエリ
を回す。

このファイルは「対象の当たり」を管理するための叩き台。
実装時に、使用するHealth Connect SDKバージョンに合わせて**実在するRecordだけに揃える**。

## 例（よく使う）
- StepsRecord
- DistanceRecord
- ActiveCaloriesBurnedRecord
- TotalCaloriesBurnedRecord
- WeightRecord
- HeightRecord
- BodyFatRecord
- SleepSessionRecord
- HeartRateRecord
- RestingHeartRateRecord
- BloodPressureRecord
- BloodGlucoseRecord
- OxygenSaturationRecord
- BodyTemperatureRecord
- RespiratoryRateRecord
- ExerciseSessionRecord
- SpeedRecord
- ActivityIntensityRecord
- SkinTemperatureRecord
- BasalMetabolicRateRecord

## 注意
- 端末/提供元アプリによってはデータが存在しないtypeがある（空でもOK）
- Nutrition系やMenstruation系など、機微情報を含むtypeがあり得る。
  - MVPは「送る」設計だが、運用上センシティブなら後で除外スイッチを追加できるようにする。
