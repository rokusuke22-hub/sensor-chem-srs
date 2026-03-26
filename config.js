// ========================================
// センサー総合化学 SRS - config.js
// 作成日時: 2026-03-26T21:30:00+09:00
// テンプレート: ネクステタイプ v2.0
// ========================================
// ★ index.html は編集不要。教材固有設定はここに集約。
// ========================================

var APP_CONFIG = {

  // ========================================
  // 1. アプリ識別（★最重要: 他教材と重複するとデータ破壊）
  // ========================================
  APP_NAME: "センサー総合化学 SRS",            // ホーム画面タイトル
  STORAGE_KEY: "sensor-chem-srs-v1",           // localStorageキー（一意必須）
  EXPORT_PREFIX: "sensor-chem-srs",            // JSONエクスポートファイル名
  SW_CACHE_NAME: "sensor-chem-srs-v1",         // sw.jsのCACHE_NAMEと一致させる

  // ========================================
  // 2. クラウド同期
  // ========================================
  GAS_URL: "https://script.google.com/macros/s/AKfycbwThaca6eYN6x_tFVqS2yIPuFOu0Hpa0DcgR87z94kL64NMkikVsS9MGfLlCM4rRwy6rw/exec",  // GASデプロイURL（空文字ならローカルのみ）

  // ========================================
  // 3. 配色（表紙のライトグレーブルー系から抽出）
  //    センサー総合化学の表紙: 淡いスチールブルー＋白
  //    → ソフトスチールブルー〜クールグレーに変換
  // ========================================
  COLORS: {
    // ページ背景・カード
    pageBg:       "#F3F5F7",      // クールなライトグレー
    cardBorder:   "#CBD4DC",      // カード枠線（スチールグレー）
    cardBg:       "#FFFFFF",      // カード背景（白）

    // テキスト
    textPrimary:  "#1F2D3D",      // 主テキスト（ダークスレート）
    textSecondary:"#4A6177",      // 補足テキスト（中間スレートブルー）
    textMuted:    "#8095A8",      // 薄いテキスト（ライトスレート）

    // ボタン
    btnPrimaryBg:    "#4A7A9B",   // プライマリボタン背景（落ち着いたスチールブルー）
    btnPrimaryFg:    "#FFFFFF",   // プライマリボタン文字（白）
    btnSecondaryBg:  "#ECF0F4",   // セカンダリボタン背景（薄いスチール）
    btnSecondaryFg:  "#4A7A9B",   // セカンダリボタン文字
    btnSecondaryBorder: "#B8C7D3",// セカンダリボタン枠線

    // 入力フィールド
    inputBorder:  "#B8C7D3",      // 入力枠線
    inputBg:      "#FAFBFC",      // 入力背景

    // ステータス
    statusOk:     "#4A8B4A",      // 正常（緑）
    statusError:  "#C53030",      // エラー（赤）
    statusMuted:  "#8095A8",      // 無効

    // 判定ボタン（○わかった / ◎余裕）※全教材で緑系統を維持
    judgeCorrectBg:     "#D4EDDA",
    judgeCorrectFg:     "#155724",
    judgeCorrectBorder: "#A3D9A3",
    judgeEasyBg:        "#C3E6CB",
    judgeEasyFg:        "#0B4F1A",
    judgeEasyBorder:    "#82C891",

    // バッジ
    badgeNewBg:     "#E4ECF2",    // 新規（薄いスチールブルー）
    badgeNewFg:     "#4A7A9B",    // 新規文字
    badgeGradBg:    "#D4EDDA",    // 卒業（緑）
    badgeGradFg:    "#1B5E20",
    badgeNeutralBg: "#E8E8E8",
    badgeNeutralFg: "#666666",
    badgePendingBg: "#FFF3E0",
    badgePendingFg: "#E65100",

    // GAS接続状態
    gasOkBg:   "#E8F5E9",
    gasOkFg:   "#2E7D32",
    gasWarnBg: "#FFF3E0",
    gasWarnFg: "#E65100",

    // コード表示・診断
    codeBg:    "#EDF1F4",
    diagBg:    "#F5F5F5",
    diagFg:    "#333333",
    diagBorder:"#CCCCCC"
  },

  // ========================================
  // 4. UI文言（センサー総合化学に最適化）
  // ========================================
  LABELS: {
    unitName:          "問題",
    registerBtn:       "問題を登録する",
    registerTitle:     "問題登録",
    idLabel:           "問題番号",
    idPlaceholder:     "例: 35, 基本例題8, 発展15",
    idHint:            "センサー総合化学の問題番号や例題番号を入力（50文字以内）",
    listTitle:         "登録一覧",
    listUnit:          "問",
    csvTitle:          "まとめて取り込み",
    reviewUnit:        "問",
    cardHint:          "センサー総合化学で該当の問題を解いてください",
    searchPlaceholder: "問題番号で検索..."
  }
};
