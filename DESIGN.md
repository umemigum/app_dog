# ピラミッド犬 設計メモ

ざっくり全体像をつかむための資料。詳細はコード内コメント参照。

## ブランチ構成

| ブランチ | 内容 |
|---|---|
| `main` | 3D版(Meshyハイブリッドモデル時代) |
| `feature/3d-tripo` | 3D版・Tripo3Dモデル(**最新の本命**) |
| `feature/2d-piramidog` | 2D版(SVGトレース。3Dが不要ならこちら) |

## 全体アーキテクチャ(3D版)

```
[アセット制作]                       [ランタイム(ブラウザ)]
AI生成モデル(Tripo3D GLB)           index.html …… UIオーバーレイ+importmap
   ↓ blender/build_from_tripo.py      main.js ……… すべてのロジック(下記)
   ↓ piramidog_tripo_self.blend       style.css …… UIスタイル
   ↓ blender/export_tripo_self.py
assets/piramidog.glb  ──────────────→  GLTFLoader で読み込み
```

- `blender/build_from_tripo.py` は Tripo3D GLB から初期のアプリ用 blend を作る変換スクリプト。パーツの自動リネーム / 向き・スケール正規化 / 両目化 / 焼き付き目の塗りつぶし / とじ目生成 / 耳・舌のピボット設定を行う。
- 現行モデルは `blender/piramidog_tripo_self.blend`。元の `Body` は消し、`InnerBody` のみを見える本体として使う手編集済み版。
- アプリ用 GLB は `/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/export_tripo_self.py` で `piramidog_tripo_self.blend` から書き出す。

## モデルの規約(アプリとGLBの契約)

アプリは**ノード名**でパーツを見つけて動かす。GLBに以下の名前が必須:

| ノード名 | 役割 | アプリでの操作 |
|---|---|---|
| `EarL` / `EarR` | 耳(原点=付け根) | クォータニオンで開閉。**ローカルZ軸回転、EarL:-角度 / EarR:+角度**(実機検証済み) |
| `EyeL` / `EyeR` | 開き目 | visible切替(まばたき) |
| `EyeClosedL/R` | とじ目(∩+まぶた) | visible切替(開き目と排他) |
| `Tongue` | 舌(原点=根元) | `scale.set(1, s, s)` でしまう/出す |
| その他(Body等) | 静的 | 名前は任意 |

注意: glTFエクスポートの都合で**子ノードのローカル軸はBlender流(Z=上、Y=前後)のまま**。
軸を変えた/モデルを差し替えたときは、必ず実機で耳の回転方向を目視確認すること
(`piramidog.update=()=>{}` で固定 → `earL.quaternion.copy(earBaseL); earL.rotateZ(-0.8)` などで試す)。

## main.js の構成(上から順)

1. **セットアップ**: renderer(NeutralToneMapping)/ 環境マップ / ライト・影
2. **草原**: 地面・草(InstancedMesh)・花・雲・ちょうちょ(全部プロシージャル)
3. **PyramidDogクラス**: ステートマシン+毎フレームのプロシージャルアニメ
   - 状態: `idle / walk / sleep / react / attend / eat / zoomies`(+petting フラグ)
     ※ごろん(roll)は動きが不自然で地面に埋まるため撤去
   - **複数匹対応**: `dogs[]` 配列で管理(通常最大 `MAX_NORMAL`=5、ちび最大 `MAX_CHIBI`=5)。
     `spawnDog({pop})` は読み込み済みGLBを `clone(true)` して増やす(骨なしなので単純クローンでOK)。
     匹数は localStorage `pd_count`(通常、最低1)/ `pd_chibi_count`(ちび、0〜5)に保存。
     各犬は独立して徘徊・睡眠・発話し、影(blobShadow)も1匹1枚。タップ/なでは `pickDog()` が
     当たった犬に作用、こっちむいて/おいで=全員、おやつ/ボール=一番近い犬(`focusedDog`/`nearestDogTo`)
   - **ちびピラミッド犬**: `PyramidDog` は `constructor({ scale = 1 })` を受け取り、
     `baseScale`(見た目の縮尺)と `isChibi`(`scale < 1`)を保持。「🐶➕ ちび」ボタンで
     `spawnDog({ pop: true, chibi: true })` → `new PyramidDog({ scale: 0.5 })` を生成し、
     通常犬と同じ `dogs[]` に混在させる(既存ロジックがそのまま全員に効く)。
     ポップイン・ジャンプの高さ・影のスケールは `baseScale` 倍、歩行速度も
     `baseScale` に応じて少しゆっくりに補正。吹き出し/エフェクトの表示高さ(`worldToScreen` の
     yOffset)も `baseScale` 倍にして、頭上からズレないようにしている。
     ボールをくわえる時は `fetcher.mouth.add(ball)` 直後に `ball.scale.setScalar(1 / fetcher.baseScale)`
     で逆補正しないと、ちびの半分スケールに引きずられてボールまで縮んで見える(要注意ポイント)。
     削除は `removeDog(chibi)` で種類を指定し、`dogs[]` の後ろからその種類の最後の1匹を削除。
     通常は1匹未満にはできないが、ちびは0匹までOK。
   - 状態は `setState(state, 秒)` で遷移。時間切れで `chooseNext()` が次を抽選
     (低確率で zoomies / ちょうちょ追い / roll を混ぜる)
   - アニメは全て update() 内で計算(ホップ=|sin|、スクワッシュ、耳lift、まばたき、
     歩行イージング、首かしげ rock、おしり振り yaw)
   - `goTo(x, z, onArrive)` で目的地+到着コールバック(おいで・おやつ・ボールに使用)。
     **注意**: onArrive は別のアクション(attend/goTo/react/グラブ)で上書き・消去される。
     そのため animate 内に**ウォッチドッグ**(0.7秒ごと)があり、放置されたおやつ/地面のボールは
     手空きの犬(idle)を再派遣、くわえたまま中断されたボールはその場に置いて自己回復する
     (`treatWalker` / `dispatchTreatWalk` / `forceDropBallInPlace`)。
     到着コールバック側にも距離チェック(>1.6で実行しない)があり、遠すぎる場合は再派遣に任せる
   - `mouth`(口もとの Object3D): ボール/食べ物をくわえる時の親
4. **アクション**: こっちむいて(`attend`)/ おいで(`goTo`)/ おやつ(落下→歩き→`eat`、
   りんご/ほね/クッキーを `TREATS` 定義で切替)/ ボール(`throwBall`→物理→fetch→carry→drop)
5. **おしゃべり**: `LINES_IYASHI` / `LINES_DOKU` を文脈タグ付きで持ち、`speak(tag)` / `speakIdle()`
   (時間帯を混ぜる)。`◯◯` を名前(なければ「きみ」)に置換
   - **モード(いやし ⇄ どくぜつ)**: `mode`(localStorage `pd_mode`、'iyashi' | 'doku'、群れ共通)。
     セリフ取得は必ず `linePool(tag)` を経由させ、`mode` に応じて `LINES_IYASHI` / `LINES_DOKU` の
     どちらを引くか切り替える(直接 `LINES_*[tag]` を参照しない)。おやつの感想
     (`TREATS[kind].lines` / `.linesDoku`)も同様に `finishEating` で分岐。右上 😇/😈 ボタンで
     トグル、切替の瞬間だけは `LINES` のタグを使わず固定文言を `showBubble` で直接表示する
     (ツンデレ演出のため)。新しいセリフタグを足すときは両方の `LINES_*` に同じタグを追加し、
     `SPEECH.md` の両モード表を更新すること
6. **時間帯連動**: `applyDaylight(hour)` が空/フォグ/太陽/環境光/星の不透明度を補間。
   2秒ごとに実時刻で更新。`window.__setHour(h)` で上書きテスト
7. **なつき度**: `bond`(localStorage `pd_bond`、群れ共通)。なでる/遊ぶ/ごはんで加点、
   レベルで💛の数(#hearts)が増える。localStorageはユーザーのブラウザにオリジン単位で
   保存(端末間同期はしない・他ユーザーとも別)
8. **エフェクト / サウンド**: 💛/Zzz/♪(HTML)、Web Audio合成(わん・しゃくっ・バウンド等)。
   **タブが隠れたら音停止**: `visibilitychange` で `AudioContext.suspend/resume`、
   かつ `audioActive()`(`!document.hidden`)でスケジューラを止める(PC/スマホ共通)
   - 全セリフと発生条件は **[SPEECH.md](SPEECH.md)** に一覧化(`LINES` と対応)
9. **入力**: 犬タップ=react / 長押し=なでなで(`petRegion` で あたま/かお/からだ を判定し反応を分岐)
   / アクションボタン / なまえモーダル / スクショ / OrbitControlsカメラ
   - **アクションパネルの開閉(8秒自動収納)**: スマホで `#actions`(こっちむいて/おいで/
     ボール/おやつ/ふやす行/ちび行)が邪魔にならないよう開閉式にしている。左下常設の
     `#actions-toggle`(FAB、🐾⇄✕)で手動開閉できるほか、パネルが展開されてから
     `pokeActionsTimer()` が8秒タイマーをセットし、時間切れで `setActionsCollapsed(true)`
     により自動収納する(CSSの `.collapsed` で `translateX(-110%)` + フェードアウト)。
     パネル内の任意のボタン押下は共通の `bindClick` ヘルパー内でタイマーをリセットするため、
     ボタン追加時の実装漏れが起きない。初期状態は展開(自動収納があるので常設しても邪魔にならない)
   - **❓ヘルプモーダル(pd_help_seen)**: `#top-buttons` の ❓ から `#help-modal` を開閉できる。
     旧来の一行ヒント(`#hint`、12秒フェード)は視認性が低く廃止し、縦リスト形式のモーダルに置換。
     初回訪問時のみ `localStorage.getItem('pd_help_seen')` が無ければ読み込み1秒後に自動表示し、
     閉じたタイミングで `pd_help_seen='1'` を保存(以降は❓ボタンから手動でのみ表示)。
     オーバーレイタップでも閉じる
   - **グラブ(つかんで持ち上げ移動)**: pointerdown 後、なでなで開始(550ms静止)より先に
     **14px以上動くと** グラブ判定(`window` の `pointermove` で監視。canvasの
     `pointermove`=カーソル変更とは別リスナー)。発動時は `clearTimeout(petInterval)` で
     なでなでタイマーを止め、犬の状態を `held`(hopY固定+ゆらゆら揺れ、`stateTime`は
     実質無期限の9999)にし、`controls.enabled = false` でカメラ回転と操作が衝突しないように
     する。掴んだ犬がボールを運搬/追跡中(`fetcher === grabbedDog`)だった場合は、
     くわえていたボールを `scene.attach` で本体に戻すなどの後始末をしてから状態遷移する。
     `pointermove` 中は raycaster と地面平面(`groundPlane`, y=0)の交点を犬のx/zに反映
     (±14でクランプ、マップ外に出ない)。`pointerup` で `held → drop` に切替え、
     `controls.enabled` を戻す。`drop` 状態は簡易重力(`dropV -= 20*dt`)で落下し、
     着地(`dropY <= 0`)で `playBounce` + ハートエフェクト + `speak('dropped')` して `idle` に戻る。
     `attend` / `goTo` / `react` は `held` / `drop` 中は何もしないようガードし、
     `packIdleChatter` の話者候補からも除外する
10. **メインループ**: rAFで `dog.update` / おやつ・ボールの物理(`stepProjectile`)/ 時間帯tick ほか
11. **PWA**: `manifest.json` + `sw.js`(同一オリジンはキャッシュ優先、CDNはネット優先)

## ハマりどころメモ

- **ブラウザキャッシュ**: GLB差し替え時は main.js の `MODEL_VERSION` を上げる(URLに ?v= が付く)。
  main.js/style.css は index.html の `?v=N`、sw.js は `CACHE` 名と `CORE` の ?v= を揃える
- **AI生成メッシュの目・影**: 目や影がテクスチャ/本体に焼き付いていることがある → 変換スクリプトの「塗りつぶし」処理が対応(暗いテクセルを肌色に)
- **スクショ**: `WebGLRenderer` は既定で描画バッファを保持しないので `preserveDrawingBuffer: true` が必須
- **デバッグ用フック**(本番で消してよい): `window.piramidog`(犬)、`window.__debugCam`(カメラ)、
  `window.__actions`(アクション)、`window.__setHour`(時刻)、`window.__bond`(なつき度)
- 検証はプレビューで: ポーズ固定 → スクリーンショット → 目視、の繰り返し
  (状態遷移の秒数は eval 越しの計測だと背景 rAF スロットリングで不正確。ポーズ固定が確実)
