# ピラミッド犬 〜いやしのまきば〜

オリジナルキャラクター「ピラミッド犬」が草原でのんびり暮らす、癒し系ブラウザアプリ。

![reference](reference/triangle-puppy-cute-render.jpg)

## あそびかた

- ピラミッド犬は勝手にぴょこぴょこ歩き回ったり、ひるねしたりします
- **タップ / クリック** … ジャンプしてよろこびます(鳴き声つき)
- **ながおし** … なでなで(♪ が出てうっとりします)
- **👀 こっちむいて** … こちらを向いてくれます
- **🐾 おいで** … カメラの近くまで来てくれます
- **🍎 りんご** … りんごをあげると食べます(しゃくしゃく)
- たまに吹き出しで話しかけてきます

> 設計の全体像は [DESIGN.md](DESIGN.md) を参照。このブランチのモデルは Tripo3D 製
> (`blender/build_from_tripo.py` で変換)。
- ドラッグでカメラを回転、ピンチ/ホイールでズームできます
- 右上の 🔊 ボタンで BGM・効果音のオン/オフ

## 起動方法

ローカルサーバーで `index.html` を配信するだけです(ビルド不要)。

```sh
python3 -m http.server 8642
# → http://localhost:8642 を開く
```

## しくみ

- **3Dモデル(ハイブリッド方式)**: Meshy AI 生成モデル(`assets/Meshy_AI_*.glb`)は本体シルエットの土台としてだけ使い、目・鼻・マズル・舌・耳は Blender プリミティブで上乗せする。`blender/build_hybrid.py` が Meshy から耳/舌/口周りの島パッチを除去 → テクスチャ補正&傷跡の塗りつぶし → 内側ピラミッドとあて布で穴を裏打ち → プリミティブ顔パーツを実測位置に配置 → `assets/piramidog.glb` にエクスポート。(旧: 全プリミティブ版 `build_piramidog.py`、全パーツ分割版 `build_from_meshy.py` も残置)
- **アニメーション**: ステートマシン(idle / walk / sleep / react)+ 毎フレームの手続き的アニメ(ホッピング、スクワッシュ&ストレッチ、まばたき、耳ぱたぱた)。GLB内の名前付きノード(EarL / EyeL / Tongue など)をコードから直接動かす
- **サウンド**: 音源ファイルなし。Web Audio API でオルゴール風ペンタトニックBGM・コードパッド・鳴き声をすべて合成
- **吹き出し・ハート・Zzz**: 3D座標をスクリーンに投影した位置に HTML/CSS で表示

## モデルの再生成(Blender が必要)

```sh
# ハイブリッドモデルを再生成(assets/piramidog.glb を上書き)
# blender/piramidog_hybrid.blend と blender/renders/hybrid_preview.png も出力される
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python blender/build_hybrid.py
```

Blender GUI で確認したいときは `blender/piramidog_hybrid.blend` を開いてください
(スクリプト再実行で上書きされる点に注意)。

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | エントリーポイント(Three.js は CDN の importmap で読込) |
| `main.js` | シーン・行動AI・サウンド・入力すべて |
| `style.css` | UIオーバーレイ(タイトル・吹き出し・エフェクト) |
| `assets/piramidog.glb` | Blender からエクスポートしたピラミッド犬モデル |
| `blender/build_piramidog.py` | モデル生成・レンダリング・エクスポートのスクリプト |
| `reference/` | キャラクター設定画 |
