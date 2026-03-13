/**
 * Google Spreadsheet → health-connect-sync 食事API 連携スクリプト
 *
 * 使い方:
 *   Apps Scriptエディタで sendUnsentRows を選択 → ▶実行
 *   結果は「実行ログ」に表示される
 */

// --- 定数 ---

var SHEET_NAME = '食事記録';
var SHEET_ID = '1woApWYDsGlSqDYz1a_rNpv0m7tA_NOckrxAXJYye-yU';
var STATUS_COL = 29; // AC列 (1-indexed)
var API_URL = 'https://health-connect-sync-api.kokomaru3-healthsync.workers.dev';
var API_KEY = 'test12345';
var SALT_TO_SODIUM_FACTOR = 394;

// カラムインデックス (0-indexed)
var COL = {
  DATE: 0,       // A: 日付
  TIME: 1,       // B: 時間
  NAME: 2,       // C: 食品名
  AMOUNT: 3,     // D: 数量
  KCAL: 4,       // E: カロリー
  PROTEIN: 5,    // F: タンパク質(g)
  FAT: 6,        // G: 脂質(g)
  CARBS: 7,      // H: 炭水化物(g)
  SALT: 8,       // I: 塩分(g)
  FIBER: 9,      // J: 食物繊維(g)
  PHOSPHORUS: 10,// K: リン(mg)
  MAGNESIUM: 11, // L: Mg(mg)
  POTASSIUM: 12, // M: K(mg)
  CALCIUM: 13,   // N: Ca(mg)
  IRON: 14,      // O: Fe(mg)
  ZINC: 15,      // P: Zn(mg)
  VIT_A: 16,     // Q: VitA(μg)
  VIT_B1: 17,    // R: VitB1(mg)
  VIT_B2: 18,    // S: VitB2(mg)
  VIT_B6: 19,    // T: VitB6(mg)
  VIT_B12: 20,   // U: VitB12(μg)
  VIT_C: 21,     // V: VitC(mg)
  VIT_D: 22,     // W: VitD(μg)
  VIT_E: 23,     // X: VitE(mg)
  NIACIN: 24,    // Y: ナイアシン(mg)
  FOLATE: 25,    // Z: 葉酸(μg)
  ALCOHOL: 26,   // AA: アルコール(g)
  NOTE: 27,      // AB: 備考
  STATUS: 28     // AC: 送信済
};

// --- セットアップ（エディタで1回だけ実行） ---

function install() {
  // 既存トリガーを削除して重複防止
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  // 1時間ごとに自動実行
  ScriptApp.newTrigger('sendUnsentRows')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('トリガー設定完了: 1時間ごとに自動送信');
}

// --- メイン処理 ---

function sendUnsentRows() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log('ERROR: シート「' + SHEET_NAME + '」が見つかりません');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('データがありません');
    return;
  }

  var dataRange = sheet.getRange(2, 1, lastRow - 1, STATUS_COL);
  var data = dataRange.getValues();

  // 未送信行を収集（AC列が空）
  var unsentByDate = {};

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var status = row[COL.STATUS];
    if (status) continue;

    var dateVal = row[COL.DATE];
    var name = row[COL.NAME];
    if (!dateVal || !name) continue;

    var localDate = formatDate_(dateVal);
    if (!localDate) continue;

    var item = buildFoodItem_(row);
    if (!item) continue;

    if (!unsentByDate[localDate]) {
      unsentByDate[localDate] = [];
    }
    unsentByDate[localDate].push({ item: item, rowIndex: i });
  }

  var allEntries = Object.values(unsentByDate).flat();
  if (allEntries.length === 0) {
    Logger.log('未送信のデータはありません');
    return;
  }

  // 日付ごとにAPI送信
  var totalSent = 0;
  var errors = [];
  var dates = Object.keys(unsentByDate).sort();

  for (var d = 0; d < dates.length; d++) {
    var date = dates[d];
    var entries = unsentByDate[date];
    var items = entries.map(function(e) { return e.item; });

    try {
      postFoodConfirm_(date, items);
      for (var j = 0; j < entries.length; j++) {
        sheet.getRange(entries[j].rowIndex + 2, STATUS_COL).setValue('済');
      }
      totalSent += items.length;
      Logger.log('OK: ' + date + ' → ' + items.length + '件送信');
    } catch (e) {
      errors.push(date + ': ' + e.message);
      Logger.log('ERROR: ' + date + ' → ' + e.message);
    }
  }

  Logger.log('--- 完了: ' + totalSent + '件 (' + dates.length + '日分) ---');
  if (errors.length > 0) {
    Logger.log('エラー: ' + errors.join(', '));
  }
}

// --- API呼び出し ---

function postFoodConfirm_(localDate, items) {
  var payload = { local_date: localDate, items: items };

  var response = UrlFetchApp.fetch(API_URL + '/api/food/confirm', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Api-Key': API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code < 200 || code >= 300) {
    var detail = body;
    try { detail = JSON.parse(body).detail || body; } catch (e) {}
    throw new Error('HTTP ' + code + ': ' + detail);
  }

  return JSON.parse(body);
}

// --- データ変換 ---

function buildFoodItem_(row) {
  var name = String(row[COL.NAME]).trim();
  if (!name) return null;

  var amount = row[COL.AMOUNT];
  var amountStr = amount ? String(amount).trim() : '1';
  if (!amountStr) amountStr = '1';

  return {
    name: name,
    brand: null,
    amount: amountStr,
    kcal: toNumOrNull_(row[COL.KCAL]) || 0,
    protein_g: toNumOrNull_(row[COL.PROTEIN]) || 0,
    fat_g: toNumOrNull_(row[COL.FAT]) || 0,
    carbs_g: toNumOrNull_(row[COL.CARBS]) || 0,
    micros: {
      sodium_mg: toNumOrNull_(row[COL.SALT]) !== null
        ? toNumOrNull_(row[COL.SALT]) * SALT_TO_SODIUM_FACTOR : null,
      fiber_g: toNumOrNull_(row[COL.FIBER]),
      phosphorus_mg: toNumOrNull_(row[COL.PHOSPHORUS]),
      magnesium_mg: toNumOrNull_(row[COL.MAGNESIUM]),
      potassium_mg: toNumOrNull_(row[COL.POTASSIUM]),
      calcium_mg: toNumOrNull_(row[COL.CALCIUM]),
      iron_mg: toNumOrNull_(row[COL.IRON]),
      zinc_mg: toNumOrNull_(row[COL.ZINC]),
      vitamin_a_ug: toNumOrNull_(row[COL.VIT_A]),
      vitamin_b1_mg: toNumOrNull_(row[COL.VIT_B1]),
      vitamin_b2_mg: toNumOrNull_(row[COL.VIT_B2]),
      vitamin_b6_mg: toNumOrNull_(row[COL.VIT_B6]),
      vitamin_b12_ug: toNumOrNull_(row[COL.VIT_B12]),
      vitamin_c_mg: toNumOrNull_(row[COL.VIT_C]),
      vitamin_d_ug: toNumOrNull_(row[COL.VIT_D]),
      vitamin_e_mg: toNumOrNull_(row[COL.VIT_E]),
      niacin_mg: toNumOrNull_(row[COL.NIACIN]),
      folate_ug: toNumOrNull_(row[COL.FOLATE]),
      alcohol_g: toNumOrNull_(row[COL.ALCOHOL]),
      saturated_fat_g: null, omega3_mg: null, omega6_mg: null,
      trans_fat_g: null, sugar_g: null, vitamin_k_ug: null,
      pantothenic_acid_mg: null, biotin_ug: null, copper_mg: null,
      manganese_mg: null, selenium_ug: null, chromium_ug: null,
      molybdenum_ug: null, iodine_ug: null, cholesterol_mg: null,
      purine_mg: null, caffeine_mg: null
    },
    meal_type: inferMealType_(row[COL.TIME]),
    save_to_favorites: false
  };
}

function inferMealType_(timeVal) {
  if (!timeVal) return null;
  var hours;
  if (timeVal instanceof Date) {
    hours = timeVal.getHours();
  } else {
    var match = String(timeVal).trim().match(/^(\d{1,2}):/);
    if (!match) return null;
    hours = parseInt(match[1], 10);
  }
  if (hours >= 5 && hours < 10) return 'breakfast';
  if (hours >= 10 && hours < 14) return 'lunch';
  if (hours >= 14 && hours < 17) return 'snack';
  if (hours >= 17 && hours < 22) return 'dinner';
  return 'snack';
}

// --- ユーティリティ ---

function formatDate_(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    var y = dateVal.getFullYear();
    var m = ('0' + (dateVal.getMonth() + 1)).slice(-2);
    var d = ('0' + dateVal.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }
  var str = String(dateVal).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function toNumOrNull_(val) {
  if (val === '' || val === null || val === undefined) return null;
  var n = Number(val);
  return isNaN(n) ? null : n;
}
