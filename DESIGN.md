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
   ↓ (Blenderをヘッドレス実行)        style.css …… UIスタイル
assets/piramidog.glb  ──────────────→  GLTFLoader で読み込み
```

- **Blenderは手作業ではなくスクリプト駆動**。`/Applications/Blender.app/Contents/MacOS/Blender --background --python blender/build_from_tripo.py` で GLB を再生成できる(同時に `blender/piramidog_tripo.blend` と確認レンダリング `blender/renders/*.png` も出力)
- 変換スクリプトがやること: パーツの自動リネーム / 向き・スケール正規化 / 両目化 / 焼き付き目の塗りつぶし / とじ目生成 / 耳・舌のピボット設定

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
   - 状態: `idle / walk / sleep / react / attend / eat`(+petting フラグ)
   - 状態は `setState(state, 秒)` で遷移。時間切れで `chooseNext()` が次を抽選
   - アニメは全て update() 内で計算(ホップ=|sin|、スクワッシュ、耳lift、まばたき)
   - `goTo(x, z, onArrive)` で目的地+到着コールバック(おいで・りんごに使用)
4. **アクション**: こっちむいて(`attend`)/ おいで(`goTo`)/ りんご(落下→歩き→`eat`)
5. **おしゃべり**: 吹き出し(HTML)を3D座標投影で追従
6. **エフェクト**: 💛/Zzz/♪ をHTMLで表示(fx-layer)
7. **サウンド**: 音源ファイルなし、全てWeb Audioで合成(BGM=ペンタトニック+パッド、わん・しゃくっ等)
8. **入力**: 犬タップ=react / 長押し=なでなで / ボタン3つ / OrbitControlsカメラ
9. **メインループ**: rAFで `dog.update(dt, t)` ほか

## ハマりどころメモ

- **ブラウザキャッシュ**: GLB差し替え時は main.js の `MODEL_VERSION` を上げる(URLに ?v= が付く)。main.js自体は index.html の `?v=N` を上げる
- **AI生成メッシュの目・影**: 目や影がテクスチャ/本体に焼き付いていることがある → 変換スクリプトの「塗りつぶし」処理が対応(暗いテクセルを肌色に)
- **デバッグ用フック**(本番で消してよい): `window.piramidog`(犬)、`window.__debugCam`(カメラ)、`window.__actions`(アクション)
- 検証はプレビューで: ポーズ固定 → スクリーンショット → 目視、の繰り返し
