# Terroir HUB WHISKY — エージェント作業マニュアル

## プロジェクト概要
全国のウイスキー蒸留所データベース。近年のクラフトウイスキーブームで急増する国内蒸留所を網羅。
デプロイ先: （未設定）
GitHub: （未設定）
姉妹サイト: https://sake.terroirhub.com/（日本酒版）、https://shochu.terroirhub.com/（焼酎版）
ドメイン: whisky.terroirhub.com

## ファイル構成

```
/Users/masuo/Desktop/terroirHUB whisky/
├── index.html                          # トップページ
├── RULES.md                            # 情報正確性ルール（必読）
├── CLAUDE.md                           # このファイル
├── template_whisky.html                # CSSテンプレート（蒸留所ページ用）
├── data/
│   └── data_{県slug}_distilleries.json # 各県の蒸留所データ
├── whisky/
│   ├── sakura_kb.json                  # AIサクラ ナレッジベース
│   ├── track.js                        # 行動データ取得スクリプト
│   ├── auth.js                         # Supabase認証
│   ├── region/                         # 8地域ページ
│   │   ├── hokkaido.html
│   │   ├── tohoku.html
│   │   ├── kanto.html
│   │   ├── chubu.html
│   │   ├── kinki.html
│   │   ├── chugoku.html
│   │   ├── shikoku.html
│   │   └── kyushu.html
│   ├── guide/                          # 教科書ページ
│   │   ├── index.html                  # ジャパニーズウイスキーの基礎
│   │   ├── types.html                  # 種類（モルト・グレーン・ブレンデッド等）
│   │   ├── production.html             # 蒸留・熟成の製法
│   │   ├── drinking.html               # 飲み方（ストレート・ロック・ハイボール等）
│   │   ├── pairing.html                # 料理ペアリング
│   │   ├── history.html                # 歴史（1923年〜のジャパニーズウイスキー）
│   │   ├── cask.html                   # 樽の種類と特徴
│   │   └── glossary.html               # 用語集
│   ├── en/                             # 英語版
│   ├── fr/                             # フランス語版
│   └── {県slug}/                       # 各県ディレクトリ
│       ├── index.html                  # 県一覧ページ
│       └── {distillery_id}.html        # 個別蒸留所ページ
├── admin/
│   └── index.html                      # 管理ダッシュボード
├── api/
│   ├── sakura.js                       # Claude AI プロキシ（AIサクラ）
│   ├── create-checkout.js              # Stripe決済
│   └── webhook.js                      # Stripeウェブフック
├── scripts/
│   ├── regenerate_all_pages.py         # 全蒸留所ページ一括生成
│   ├── generate_pref_index.py          # 県一覧ページ生成
│   ├── generate_sitemap.py             # サイトマップ生成
│   ├── build_search_index.py           # 検索インデックス構築
│   ├── build_sakura_kb.py              # AIナレッジベース構築
│   └── generate_multilang_pages.py     # 多言語版生成
├── vercel.json
├── robots.txt
├── sitemap.xml
└── package.json
```

## データ形式（JSON）

各`data/{県slug}_distilleries.json`は配列。1蒸留所あたり:

```json
{
  "id": "yamazaki",
  "name": "山崎蒸溜所",
  "company": "サントリースピリッツ（株）",
  "brand": "山崎",
  "whisky_type": "malt",
  "cask_type": "ミズナラ樽・シェリー樽・バーボン樽",
  "age_statement": "12",
  "abv": "43",
  "founded": "1923",
  "founded_era": "大正12年",
  "address": "大阪府三島郡島本町山崎5-2-1",
  "tel": "075-962-1423",
  "url": "https://www.suntory.co.jp/factory/yamazaki/",
  "area": "島本町",
  "desc": "大正12年（1923年）、鳥井信治郎が日本初のモルトウイスキー蒸溜所として開設。天王山の麓、三川合流の地で良質な水に恵まれる。",
  "visit": "山崎ウイスキー館にて見学ツアーあり（要予約・有料）",
  "brands": [
    {
      "name": "山崎12年",
      "type": "シングルモルトウイスキー",
      "specs": "シェリー樽・ミズナラ樽原酒をヴァッティング、アルコール43度",
      "cask_type": "シェリー樽・ミズナラ樽",
      "age_statement": "12",
      "abv": "43"
    },
    {
      "name": "山崎 NAS",
      "type": "シングルモルトウイスキー",
      "specs": "多彩な原酒をヴァッティング、アルコール43度",
      "cask_type": "",
      "age_statement": "NAS",
      "abv": "43"
    }
  ],
  "features": [
    "1923年創業、日本最古のモルトウイスキー蒸溜所",
    "天王山の麓、桂川・宇治川・木津川の三川合流地点に位置",
    "ミズナラ樽による独自の熟成技術"
  ],
  "nearest_station": "JR東海道本線 山崎駅（徒歩約10分）",
  "source": "https://www.suntory.co.jp/factory/yamazaki/",
  "lat": 34.8917,
  "lng": 135.6789,
  "name_en": "Yamazaki Distillery"
}
```

### 焼酎版との差分フィールド（ウイスキー固有）
| フィールド | 説明 | 例 |
|-----------|------|-----|
| `whisky_type` | ウイスキーの種類 | "malt" / "grain" / "blended" / "blended_malt" / "single_cask" |
| `cask_type` | 樽の種類 | "バーボン樽" / "シェリー樽" / "ミズナラ樽" / "ワイン樽" |
| `age_statement` | 年数表記 | "NAS" / "3" / "10" / "12" / "18" / "25" |
| `abv` | アルコール度数 | "43" / "46" / "51.4" |
| `brands[].cask_type` | 銘柄ごとの樽種 | "シェリー樽・ミズナラ樽" |
| `brands[].age_statement` | 銘柄ごとの年数 | "12" |
| `brands[].abv` | 銘柄ごとの度数 | "43" |

### ウイスキータイプ分類
| コード | 日本語 | 英語 |
|--------|--------|------|
| malt | シングルモルト | Single Malt |
| grain | シングルグレーン | Single Grain |
| blended | ブレンデッド | Blended |
| blended_malt | ブレンデッドモルト | Blended Malt |
| single_cask | シングルカスク | Single Cask |

### 樽タイプ分類
| 樽名 | 風味特徴 |
|------|----------|
| バーボン樽 | バニラ・キャラメル・ハニー |
| シェリー樽 | ドライフルーツ・スパイス・チョコレート |
| ミズナラ樽 | 白檀・伽羅・オリエンタルスパイス |
| ワイン樽 | ベリー・タンニン・フルーティー |
| ラム樽 | トロピカルフルーツ・糖蜜 |
| ポートパイプ | プラム・ナッツ・甘味 |
| パンチョン | まろやか・バランス重視 |

## 品質ランク定義

| ランク | 条件 | 状態 |
|--------|------|------|
| A | founded + brands(1〜3銘柄) + features(2+) + url + whisky_type | 完全版 |
| B | founded + brands or features あるがURL無し or whisky_type未設定 | 要改善 |
| C | foundedのみ | 最低限 |
| D | 何もなし | 対象外 |

**目標: 主要蒸留所（サントリー・ニッカ・キリン・ベンチャーウイスキー等）は全蔵Aランク**

## AIコンシェルジュ「サクラ」（全サイト共通）

全Terroir HUBサイト共通のAIコンシェルジュ「サクラ」。
- 知識ベース: `whisky/sakura_kb.json`
- API: `/api/sakura.js`
- キャラクター: ウイスキーの深い世界を語る、上品で知的な案内人

## データソース（蒸留所リスト取得元）

### 業界団体
| ソース | URL | 備考 |
|---|---|---|
| 日本洋酒酒造組合 | https://yoshu.or.jp/ | ウイスキー製造者の業界団体 |
| Japan Whisky Research Centre | https://whiskymag.jp/ | ウイスキー専門メディア |

### 全国データソース
| ソース | URL | 備考 |
|---|---|---|
| 国税庁 酒蔵マップ | https://www.nta.go.jp/taxes/sake/sakagura/index.htm | 公式データ |
| 日本洋酒酒造組合 会員一覧 | https://yoshu.or.jp/member/ | 組合員リスト |

### 主要蒸留所
| 蒸留所名 | 所在地 | 運営 |
|---|---|---|
| 山崎蒸溜所 | 大阪府島本町 | サントリー |
| 白州蒸溜所 | 山梨県北杜市 | サントリー |
| 余市蒸溜所 | 北海道余市町 | ニッカウヰスキー |
| 宮城峡蒸溜所 | 宮城県仙台市 | ニッカウヰスキー |
| 富士御殿場蒸溜所 | 静岡県御殿場市 | キリンディスティラリー |
| 秩父蒸溜所 | 埼玉県秩父市 | ベンチャーウイスキー |
| 厚岸蒸溜所 | 北海道厚岸町 | 堅展実業 |
| 三郎丸蒸留所 | 富山県砺波市 | 若鶴酒造 |
| 長濱蒸溜所 | 滋賀県長浜市 | 長濱浪漫ビール |
| 嘉之助蒸溜所 | 鹿児島県日置市 | 小正醸造 |

## 絶対にやってはいけないこと

1. **情報を捏造しない** — 公式サイトにない情報は入れない
2. **推測で埋めない** — 分からない項目は空欄のまま
3. **AIが文章を生成しない** — 説明文は公式サイトの文言を使う
4. **他の蒸留所のデータを混同しない** — IDと蒸留所名を必ず照合
5. **偽の年数表記（age statement）を入れない** — NAS（ノンエイジステートメント）の商品に勝手に年数を付けない
6. **樽タイプを推測で書かない** — 公式に発表されている情報のみ記載
7. **brandsにspecs=""で入れて「完了」と言わない** — 実データがないならBランクと正直に報告

## 県slugマッピング

```
hokkaido aomori iwate miyagi akita yamagata fukushima
ibaraki tochigi gunma saitama chiba tokyo kanagawa
niigata toyama ishikawa fukui yamanashi nagano gifu shizuoka aichi
mie shiga kyoto osaka hyogo nara wakayama
tottori shimane okayama hiroshima yamaguchi
tokushima kagawa ehime kochi
fukuoka saga nagasaki kumamoto oita miyazaki kagoshima okinawa
```
