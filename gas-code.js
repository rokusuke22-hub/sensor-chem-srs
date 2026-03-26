// ========================================
// センサー総合化学 SRS - GASコード v1.0
// 作成日時: 2026-03-26T21:30:00+09:00
// ベース: ネクステSRS v1.0 テンプレートから展開
// ========================================
// 定数3箇所のみ変更:
//   SPREADSHEET_ID → デプロイ時に自分のIDに置き換え
//   SHEET_NAME_DATA → SC_SRS_Data
//   SHEET_NAME_META → SC_SRS_Meta
// ========================================
// テスト関数 T-G01〜T-G11 を末尾に実装
// GASエディタから個別実行可能
// ========================================

// ========================================
// 定数定義
// ========================================

// スプレッドシートID（★デプロイ時に自分のIDに置き換えてください）
var SPREADSHEET_ID = "1uJtQYGP5AlEkCQMdVke1bPE5QDoVPxmV4-_MCo1B37o";

// シート名（★センサー総合化学用。他教材と重複不可）
var SHEET_NAME_DATA = "SC_SRS_Data";    // NS/K1/EM/SP/KT と非重複
var SHEET_NAME_META = "SC_SRS_Meta";

// 列インデックス（0始まり）
// ★No.5: PHRASE(1), MEANING(2) を廃止し、残りを繰り上げ
var COL = {
  ID: 0,           // A列: 問題識別子（★文字列型。例: "42", "P45-3", "文法12"）
  REPETITIONS: 1,  // B列: 復習回数          （シス単: 3）
  INTERVAL: 2,     // C列: 復習間隔（日数）   （シス単: 4）
  EASE_FACTOR: 3,  // D列: 難易度係数         （シス単: 5）
  NEXT_REVIEW: 4,  // E列: 次回復習日         （シス単: 6）
  LAST_REVIEW: 5,  // F列: 最終復習日         （シス単: 7）
  LAST_QUALITY: 6, // G列: 最後の判定         （シス単: 8）
  GRADUATED: 7,    // H列: 卒業フラグ         （シス単: 9）
  CREATED: 8,      // I列: 作成日             （シス単: 10）
  RESERVED: 9      // J列: 予備               （シス単: 11）
};

// データ範囲
var DATA_START_ROW = 2;       // データは2行目から（1行目はヘッダー）
var DATA_MAX_ROWS = 10000;    // スケーラビリティ確保
var DATA_COLS = 10;           // ★No.6: 12→10列

// ヘッダー行の内容（★No.7: phrase/meaning列削除）
var HEADER_ROW = [
  "id", "repetitions", "interval",
  "easeFactor", "nextReviewDate", "lastReviewDate",
  "lastQuality", "graduated", "createdDate", "reserved"
];

// ========================================
// ヘルパー関数
// ========================================

/**
 * スプレッドシートオブジェクトを取得
 * ※ getActiveSpreadsheet() は Web App では動作しないため openById を使用
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * データシートを取得（なければ作成）
 */
function getDataSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_DATA);

  if (!sheet) {
    // 新規シート作成
    sheet = ss.insertSheet(SHEET_NAME_DATA);
    // ヘッダー行を設定
    sheet.getRange(1, 1, 1, DATA_COLS).setValues([HEADER_ROW]);
    // ヘッダー行を固定
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * メタデータシートを取得（なければ作成）
 * A1: タイムスタンプ
 * B1: 最後のrequestID
 * C1: settings JSON
 */
function getMetaSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_META);

  if (!sheet) {
    // 新規シート作成
    sheet = ss.insertSheet(SHEET_NAME_META);
    sheet.getRange("A1").setValue(Date.now()); // 初期タイムスタンプ
    sheet.getRange("B1").setValue("");         // requestID
    sheet.getRange("C1").setValue("");         // settings JSON
  }

  return sheet;
}

/**
 * タイムスタンプを取得（読み取り専用。更新はしない）
 */
function getTimestamp() {
  var metaSheet = getMetaSheet();
  var ts = metaSheet.getRange("A1").getValue();
  return ts || Date.now();
}

/**
 * タイムスタンプを設定（書き込み時のみ呼ぶ）
 */
function setTimestamp(timestamp) {
  var metaSheet = getMetaSheet();
  metaSheet.getRange("A1").setValue(timestamp);
}

/**
 * 最後のrequestIDを設定（デバッグ用）
 */
function setLastRequestId(requestId) {
  var metaSheet = getMetaSheet();
  metaSheet.getRange("B1").setValue(requestId || "");
}

/**
 * settings を Meta シートに保存
 */
function saveSettings(settings) {
  if (!settings) return;
  var metaSheet = getMetaSheet();
  // gasUrl は保存しない（セキュリティ＋Safari問題回避）
  var toSave = {
    dailyLimit: settings.dailyLimit || 50,
    graduationDays: settings.graduationDays || 30
  };
  metaSheet.getRange("C1").setValue(JSON.stringify(toSave));
}

/**
 * settings を Meta シートから読み込み
 */
function loadSettings() {
  var metaSheet = getMetaSheet();
  var raw = metaSheet.getRange("C1").getValue();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      // パース失敗時はデフォルト値
    }
  }
  return { dailyLimit: 50, graduationDays: 30 };
}

/**
 * JSONレスポンスを返す
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================================
// データ変換関数
// ========================================

/**
 * Wordオブジェクトを行配列に変換
 * ★No.20: idをNumber()キャストせず文字列のまま保存
 * ★No.5: phrase/meaning列なし → 10要素の配列を返す
 * @param {Object} word - 問題オブジェクト
 * @return {Array} - 行配列（10要素）
 */
function wordToRow(word) {
  return [
    String(word.id || ""),                             // A: id（★文字列型）
    word.repetitions || 0,                             // B: repetitions（数値）
    word.interval || 0,                                // C: interval（数値）
    Number(word.easeFactor) || 2.5,                    // D: easeFactor（数値）
    formatDate(word.nextReviewDate) || "",             // E: nextReviewDate（YYYYMMDD）
    formatDate(word.lastReviewDate) || "",             // F: lastReviewDate（YYYYMMDD）
    word.lastQuality || "",                            // G: lastQuality（文字列）
    word.graduated ? 1 : 0,                            // H: graduated（0/1）
    formatDate(word.createdDate) || "",                // I: createdDate（YYYYMMDD）
    ""                                                 // J: 予備
  ];
}

/**
 * 行配列をWordオブジェクトに変換
 * ★No.20: idをNumber()変換せず文字列のまま返す
 * ★No.5: phrase/meaning列なし
 * @param {Array} row - 行配列（10要素）
 * @return {Object} - 問題オブジェクト
 */
function rowToWord(row) {
  return {
    id: String(row[COL.ID] || ""),                     // ★文字列型
    repetitions: row[COL.REPETITIONS] || 0,
    interval: row[COL.INTERVAL] || 0,
    easeFactor: Number(row[COL.EASE_FACTOR]) || 2.5,
    nextReviewDate: parseDate(row[COL.NEXT_REVIEW]) || "",
    lastReviewDate: parseDate(row[COL.LAST_REVIEW]) || "",
    lastQuality: row[COL.LAST_QUALITY] || "",
    graduated: row[COL.GRADUATED] == 1,
    createdDate: parseDate(row[COL.CREATED]) || ""
  };
}

/**
 * 日付文字列をYYYYMMDD形式に変換（シート保存用）
 */
function formatDate(dateStr) {
  if (!dateStr) return "";
  dateStr = String(dateStr);
  if (/^\d{8}$/.test(dateStr)) return dateStr;                       // すでにYYYYMMDD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr.replace(/-/g, ""); // YYYY-MM-DD→YYYYMMDD
  return "";
}

/**
 * YYYYMMDD形式をYYYY-MM-DD形式に変換（アプリ側で使う形式）
 */
function parseDate(dateStr) {
  if (!dateStr) return "";
  dateStr = String(dateStr);
  if (/^\d{8}$/.test(dateStr)) {
    return dateStr.substring(0, 4) + "-" +
           dateStr.substring(4, 6) + "-" +
           dateStr.substring(6, 8);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return "";
}

// ========================================
// doGet: データ読み込み（タイムスタンプ更新なし）
// ========================================
function doGet(e) {
  try {
    var sheet = getDataSheet();

    // 全データ行を取得
    var lastRow = sheet.getLastRow();
    var numRows = Math.max(1, lastRow - 1); // ヘッダー除く
    var range = sheet.getRange(DATA_START_ROW, 1, numRows, DATA_COLS);
    var values = range.getValues();

    // 行データをWordオブジェクトに変換
    var words = {};
    values.forEach(function(row) {
      var id = String(row[COL.ID] || "").trim(); // ★文字列として読み取り
      if (id) { // IDが存在する行のみ処理
        words[id] = rowToWord(row);
      }
    });

    // タイムスタンプ取得（読むだけ。更新しない）
    var timestamp = getTimestamp();

    // settings を読み込み
    var settings = loadSettings();

    // デバッグ用: requestId 記録
    if (e && e.parameter && e.parameter.requestId) {
      setLastRequestId(e.parameter.requestId);
    }

    // レスポンス
    return createJsonResponse({
      status: "ok",
      data: {
        words: words,
        settings: settings
      },
      timestamp: timestamp
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      error: error.toString(),
      stack: error.stack
    });
  }
}

// ========================================
// doPost: データ書き込み
// ========================================
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var sheet = getDataSheet();

    // body.data.words を読む（フロントは body.data にネストして送信する）
    var wordsData = (body.data && body.data.words) ? body.data.words : body.words;
    var settingsData = (body.data && body.data.settings) ? body.data.settings : body.settings;

    // words が取得できなかった場合はエラー
    if (!wordsData || typeof wordsData !== "object") {
      return createJsonResponse({
        status: "error",
        message: "wordsデータが見つかりません。body.data.words または body.words が必要です。"
      });
    }

    // タイムスタンプチェック（競合検出）
    var currentTimestamp = getTimestamp();
    if (body.timestamp && body.timestamp < currentTimestamp) {
      return createJsonResponse({
        status: "conflict",
        message: "別の端末で更新があります",
        currentTimestamp: currentTimestamp
      });
    }

    // Wordオブジェクトを行配列に変換
    // ★No.21: 数値ソート→文字列辞書順に変更（非数値idでNaN防止）
    var rows = [];
    var ids = Object.keys(wordsData).sort(); // 文字列辞書順ソート

    ids.forEach(function(id) {
      rows.push(wordToRow(wordsData[id]));
    });

    // データ書き込み
    if (rows.length > 0) {
      var targetRange = sheet.getRange(
        DATA_START_ROW,
        1,
        rows.length,
        DATA_COLS
      );
      targetRange.setValues(rows);
    }

    // 書き込んだ行の後ろにある古いデータをクリア（幽霊データ防止）
    var lastRow = sheet.getLastRow();
    var newLastDataRow = DATA_START_ROW + rows.length - 1; // 新しいデータの最終行
    if (lastRow > newLastDataRow) {
      var excessRows = lastRow - newLastDataRow;
      sheet.getRange(newLastDataRow + 1, 1, excessRows, DATA_COLS).clearContent();
    }

    // settings を保存
    if (settingsData) {
      saveSettings(settingsData);
    }

    // 新しいタイムスタンプを設定
    var newTimestamp = Date.now();
    setTimestamp(newTimestamp);

    // デバッグ用: requestId 記録
    if (body.requestId) {
      setLastRequestId(body.requestId);
    }

    // レスポンス
    return createJsonResponse({
      status: "ok",
      timestamp: newTimestamp,
      rowsWritten: rows.length
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      error: error.toString(),
      stack: error.stack
    });
  }
}

// ========================================
// テスト関数（GASエディタから個別実行可能）
// 設計書v1.1 SECTION 7-3 テストID T-G01〜T-G11
// ========================================

/**
 * テスト共通: データシートをクリアして空状態にする
 * テスト間の依存をなくすため、各テスト冒頭で呼ぶ
 */
function _clearDataSheet() {
  var sheet = getDataSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(DATA_START_ROW, 1, lastRow - 1, DATA_COLS).clearContent();
  }
}

/**
 * テスト共通: doPostを擬似実行するヘルパー
 * @param {Object} wordsObj - { "id文字列": wordオブジェクト, ... }
 * @param {Object} settingsObj - settings オブジェクト（省略可）
 * @return {Object} - パース済みレスポンス
 */
function _simulatePost(wordsObj, settingsObj) {
  var payload = {
    timestamp: Date.now(),
    data: {
      words: wordsObj,
      settings: settingsObj || { dailyLimit: 50, graduationDays: 30 }
    },
    requestId: "test_" + Date.now()
  };
  var e = { postData: { contents: JSON.stringify(payload) } };
  var result = doPost(e);
  return JSON.parse(result.getContent());
}

/**
 * テスト共通: doGetを擬似実行するヘルパー
 * @return {Object} - パース済みレスポンス
 */
function _simulateGet() {
  var result = doGet({});
  return JSON.parse(result.getContent());
}

/**
 * テスト共通: 問題オブジェクトを生成するヘルパー
 * @param {string} id - 問題識別子（文字列）
 * @param {Object} overrides - 上書きプロパティ（省略可）
 * @return {Object} - 問題オブジェクト
 */
function _makeTestWord(id, overrides) {
  var base = {
    id: String(id),
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: "2026-04-01",
    lastReviewDate: "2026-03-25",
    lastQuality: "correct",
    graduated: false,
    createdDate: "2026-03-25"
  };
  if (overrides) {
    var keys = Object.keys(overrides);
    for (var i = 0; i < keys.length; i++) {
      base[keys[i]] = overrides[keys[i]];
    }
  }
  return base;
}

// ------------------------------------------
// T-G01: testDoGet_empty
// 空シートでdoGetを実行 → status='ok', words={}
// ------------------------------------------
function T_G01_testDoGet_empty() {
  _clearDataSheet();
  var res = _simulateGet();

  var pass = true;
  if (res.status !== "ok") { Logger.log("FAIL: status=" + res.status); pass = false; }
  if (Object.keys(res.data.words).length !== 0) { Logger.log("FAIL: words not empty, got " + Object.keys(res.data.words).length); pass = false; }

  Logger.log("T-G01 testDoGet_empty: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G02: testDoPost_single
// 1問（id='42'）をPOSTし、doGetで読み戻し
// → POSTした内容と一致
// ------------------------------------------
function T_G02_testDoPost_single() {
  _clearDataSheet();

  var word = _makeTestWord("42");
  var postRes = _simulatePost({ "42": word });
  if (postRes.status !== "ok") { Logger.log("FAIL: POST status=" + postRes.status); Logger.log("T-G02: FAIL"); return false; }

  var getRes = _simulateGet();
  var pass = true;
  if (!getRes.data.words["42"]) { Logger.log("FAIL: id '42' not found in GET response"); pass = false; }
  else {
    var w = getRes.data.words["42"];
    if (w.id !== "42") { Logger.log("FAIL: id mismatch: " + w.id); pass = false; }
    if (w.easeFactor !== 2.5) { Logger.log("FAIL: easeFactor mismatch: " + w.easeFactor); pass = false; }
    if (w.nextReviewDate !== "2026-04-01") { Logger.log("FAIL: nextReviewDate mismatch: " + w.nextReviewDate); pass = false; }
    if (w.createdDate !== "2026-03-25") { Logger.log("FAIL: createdDate mismatch: " + w.createdDate); pass = false; }
  }

  Logger.log("T-G02 testDoPost_single: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G03: testDoPost_overwrite
// 3問POST→2問POST→doGet → 2問のみ返却、幽霊なし
// ------------------------------------------
function T_G03_testDoPost_overwrite() {
  _clearDataSheet();

  // まず3問書き込み
  var words3 = {
    "10": _makeTestWord("10"),
    "20": _makeTestWord("20"),
    "30": _makeTestWord("30")
  };
  _simulatePost(words3);

  // 次に2問だけ書き込み（30は削除された想定）
  var words2 = {
    "10": _makeTestWord("10"),
    "20": _makeTestWord("20")
  };
  _simulatePost(words2);

  // 読み戻し
  var getRes = _simulateGet();
  var ids = Object.keys(getRes.data.words);
  var pass = true;

  if (ids.length !== 2) { Logger.log("FAIL: expected 2 words, got " + ids.length); pass = false; }
  if (getRes.data.words["30"]) { Logger.log("FAIL: ghost data '30' still exists"); pass = false; }

  Logger.log("T-G03 testDoPost_overwrite: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G04: testDoPost_conflict
// 古いタイムスタンプでPOST → status='conflict'
// ------------------------------------------
function T_G04_testDoPost_conflict() {
  _clearDataSheet();

  // まず1問書き込み（タイムスタンプが設定される）
  _simulatePost({ "1": _makeTestWord("1") });

  // 古いタイムスタンプ（1）でPOSTを試行
  var payload = {
    timestamp: 1, // 意図的に古い値
    data: {
      words: { "2": _makeTestWord("2") },
      settings: { dailyLimit: 50, graduationDays: 30 }
    }
  };
  var e = { postData: { contents: JSON.stringify(payload) } };
  var result = JSON.parse(doPost(e).getContent());

  var pass = (result.status === "conflict");
  if (!pass) { Logger.log("FAIL: expected 'conflict', got '" + result.status + "'"); }

  Logger.log("T-G04 testDoPost_conflict: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G05: testSettings_roundtrip
// settings保存→読込 → dailyLimit/graduationDays一致
// ------------------------------------------
function T_G05_testSettings_roundtrip() {
  var testSettings = { dailyLimit: 75, graduationDays: 45 };
  saveSettings(testSettings);
  var loaded = loadSettings();

  var pass = true;
  if (loaded.dailyLimit !== 75) { Logger.log("FAIL: dailyLimit=" + loaded.dailyLimit); pass = false; }
  if (loaded.graduationDays !== 45) { Logger.log("FAIL: graduationDays=" + loaded.graduationDays); pass = false; }

  // 元に戻す
  saveSettings({ dailyLimit: 50, graduationDays: 30 });

  Logger.log("T-G05 testSettings_roundtrip: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G06: testWordToRow_cols
// wordToRow出力が10列であること → 配列長===10
// ------------------------------------------
function T_G06_testWordToRow_cols() {
  var word = _makeTestWord("42");
  var row = wordToRow(word);

  var pass = (row.length === 10);
  if (!pass) { Logger.log("FAIL: expected 10 cols, got " + row.length); }

  Logger.log("T-G06 testWordToRow_cols: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G07: testRowToWord_roundtrip
// wordToRow→rowToWord→wordToRow → 入力と出力が完全一致
// ------------------------------------------
function T_G07_testRowToWord_roundtrip() {
  var original = _makeTestWord("P45-3");
  var row1 = wordToRow(original);
  var reconstructed = rowToWord(row1);
  var row2 = wordToRow(reconstructed);

  var pass = true;
  for (var i = 0; i < row1.length; i++) {
    if (String(row1[i]) !== String(row2[i])) {
      Logger.log("FAIL: col " + i + " mismatch: '" + row1[i] + "' vs '" + row2[i] + "'");
      pass = false;
    }
  }

  Logger.log("T-G07 testRowToWord_roundtrip: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G08: testDateFormat
// YYYY-MM-DD⇔YYYYMMDD変換 → 往復で元に戻る
// ------------------------------------------
function T_G08_testDateFormat() {
  var pass = true;

  // YYYY-MM-DD → YYYYMMDD → YYYY-MM-DD
  var d1 = "2026-04-01";
  var formatted = formatDate(d1);    // → "20260401"
  var parsed = parseDate(formatted); // → "2026-04-01"
  if (parsed !== d1) { Logger.log("FAIL: roundtrip1: " + d1 + " → " + formatted + " → " + parsed); pass = false; }

  // YYYYMMDD → YYYY-MM-DD → YYYYMMDD
  var d2 = "20260401";
  var parsed2 = parseDate(d2);       // → "2026-04-01"
  var formatted2 = formatDate(parsed2); // → "20260401"
  if (formatted2 !== d2) { Logger.log("FAIL: roundtrip2: " + d2 + " → " + parsed2 + " → " + formatted2); pass = false; }

  // 空文字
  if (formatDate("") !== "") { Logger.log("FAIL: empty string"); pass = false; }
  if (parseDate("") !== "") { Logger.log("FAIL: empty string parse"); pass = false; }

  Logger.log("T-G08 testDateFormat: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G09: testTimestamp_update
// POST後にタイムスタンプが更新 → POST後ts > POST前ts
// ------------------------------------------
function T_G09_testTimestamp_update() {
  _clearDataSheet();

  var tsBefore = getTimestamp();

  // 少し待ってからPOST（タイムスタンプの差を確保）
  Utilities.sleep(50);
  _simulatePost({ "1": _makeTestWord("1") });

  var tsAfter = getTimestamp();

  var pass = (tsAfter > tsBefore);
  if (!pass) { Logger.log("FAIL: ts not updated. before=" + tsBefore + ", after=" + tsAfter); }

  Logger.log("T-G09 testTimestamp_update: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G10: testStringId
// id='P45-3'（記号含む文字列）の登録・読戻し
// → idが文字列のまま保存・復元される
// ------------------------------------------
function T_G10_testStringId() {
  _clearDataSheet();

  var word = _makeTestWord("P45-3");
  _simulatePost({ "P45-3": word });

  var getRes = _simulateGet();
  var pass = true;

  if (!getRes.data.words["P45-3"]) {
    Logger.log("FAIL: id 'P45-3' not found in GET response");
    Logger.log("  Available keys: " + Object.keys(getRes.data.words).join(", "));
    pass = false;
  } else {
    var w = getRes.data.words["P45-3"];
    if (w.id !== "P45-3") { Logger.log("FAIL: id field mismatch: '" + w.id + "' (expected 'P45-3')"); pass = false; }
    if (typeof w.id !== "string") { Logger.log("FAIL: id is not string type: " + typeof w.id); pass = false; }
  }

  Logger.log("T-G10 testStringId: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// T-G11: testStringId_sort
// id='B3','A1','C2'を登録→doGet
// → スプレッドシート上の行順が辞書順（A1, B3, C2）
// ------------------------------------------
function T_G11_testStringId_sort() {
  _clearDataSheet();

  var words = {
    "B3": _makeTestWord("B3"),
    "A1": _makeTestWord("A1"),
    "C2": _makeTestWord("C2")
  };
  _simulatePost(words);

  // スプレッドシートの行を直接確認（doGetではなく生データ確認）
  var sheet = getDataSheet();
  var row2id = String(sheet.getRange(2, 1).getValue()); // 1行目のデータ
  var row3id = String(sheet.getRange(3, 1).getValue()); // 2行目のデータ
  var row4id = String(sheet.getRange(4, 1).getValue()); // 3行目のデータ

  var pass = true;
  if (row2id !== "A1") { Logger.log("FAIL: row2 expected 'A1', got '" + row2id + "'"); pass = false; }
  if (row3id !== "B3") { Logger.log("FAIL: row3 expected 'B3', got '" + row3id + "'"); pass = false; }
  if (row4id !== "C2") { Logger.log("FAIL: row4 expected 'C2', got '" + row4id + "'"); pass = false; }

  // doGetでも全3問が返ること
  var getRes = _simulateGet();
  if (Object.keys(getRes.data.words).length !== 3) {
    Logger.log("FAIL: expected 3 words, got " + Object.keys(getRes.data.words).length);
    pass = false;
  }

  Logger.log("T-G11 testStringId_sort: " + (pass ? "PASS" : "FAIL"));
  return pass;
}

// ------------------------------------------
// 全テスト一括実行
// GASエディタから runAllTests() を実行すると全テストを順番に走らせる
// ------------------------------------------
function runAllTests() {
  Logger.log("========================================");
  Logger.log("センサー総合化学 SRS GAS テスト実行 - " + new Date().toISOString());
  Logger.log("========================================");

  var results = [];
  results.push({ id: "T-G01", pass: T_G01_testDoGet_empty() });
  results.push({ id: "T-G02", pass: T_G02_testDoPost_single() });
  results.push({ id: "T-G03", pass: T_G03_testDoPost_overwrite() });
  results.push({ id: "T-G04", pass: T_G04_testDoPost_conflict() });
  results.push({ id: "T-G05", pass: T_G05_testSettings_roundtrip() });
  results.push({ id: "T-G06", pass: T_G06_testWordToRow_cols() });
  results.push({ id: "T-G07", pass: T_G07_testRowToWord_roundtrip() });
  results.push({ id: "T-G08", pass: T_G08_testDateFormat() });
  results.push({ id: "T-G09", pass: T_G09_testTimestamp_update() });
  results.push({ id: "T-G10", pass: T_G10_testStringId() });
  results.push({ id: "T-G11", pass: T_G11_testStringId_sort() });

  Logger.log("========================================");
  Logger.log("テスト結果サマリ");
  Logger.log("========================================");
  var passCount = 0;
  var failCount = 0;
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    Logger.log("  " + r.id + ": " + (r.pass ? "PASS" : "*** FAIL ***"));
    if (r.pass) passCount++; else failCount++;
  }
  Logger.log("========================================");
  Logger.log("PASS: " + passCount + " / FAIL: " + failCount + " / TOTAL: " + results.length);
  Logger.log("========================================");

  return failCount === 0;
}

// ------------------------------------------
// データ状態チェック（運用時のデバッグ用）
// ------------------------------------------
function checkDataStatus() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME_DATA);
  if (sheet) {
    var lastRow = sheet.getLastRow();
    Logger.log("========================================");
    Logger.log("センサー総合化学 SRS データ状態チェック");
    Logger.log("========================================");
    Logger.log("シート名: " + SHEET_NAME_DATA);
    Logger.log("データ行数: " + (lastRow - 1) + "行");
    Logger.log("タイムスタンプ: " + getTimestamp());
    Logger.log("settings: " + JSON.stringify(loadSettings()));
    Logger.log("========================================");
  } else {
    Logger.log("シート '" + SHEET_NAME_DATA + "' が見つかりません（初回実行時に自動作成されます）");
  }
}
