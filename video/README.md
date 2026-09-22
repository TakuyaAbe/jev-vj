# Jev VJ — 操作方法説明ビデオ（Remotion）

`video/` は独立した npm プロジェクト。Playwright で動いているアプリを撮影し、Remotion で日本語ナレーション＋字幕付きの
操作方法説明（1920×1080 · 30 fps · h264 · 約 3 分）を組み立てる。成果物は `out/jev-vj-howto.mp4`。

```bash
cd video && npm install                                   # remotion / playwright など（~/.npm の都合で sandbox 外で）
python3 -m venv .venv && .venv/bin/pip install edge-tts   # 任意: 無ければ ../../aeon360-demo/video/.venv を探し、それも無ければ macOS `say -v Kyoko`
node fonts.mjs        # Noto Sans JP（可変 TTF）を public/fonts/ に自己ホスト（1 回だけ・要ネット）
node audio.mjs        # BGM ループ + 効果音を合成 → public/audio/{bgm,tap,pop,whoosh}.wav（サンプル不使用）
node narration.mjs    # ナレーション → public/narration/*.wav + durations.json（変わった行だけ再合成。FORCE=1 で全部）
                      #   TTS_VOICE=ja-JP-KeitaNeural / TTS_RATE=+15% / TTS_ENGINE=say
(cd .. && npm run dev)  # 撮影対象: http://127.0.0.1:5183（TYPESAFE_API_KEY が必要。Jev の合議は実 API）
node capture.mjs      # 撮影 → public/captures/app.mp4 + 各ステップの静止画 + public/audio/demo-track.wav + public/timeline.json（約 3.5 分）
                      #   CAPTURE_BASE_URL=https://jevj.sayuno.me node capture.mjs で公開版を撮る
npm run render        # → out/jev-vj-howto.mp4
npm run studio        # Remotion Studio で構成を調整（撮影前でも script.json から仮タイムラインを作って動く）
```

## 構成

すべて `script.json` が起点:

- `cards.title / overview / keys / outro` — タイトル・図解（仕組み）・キーボード早見・URL の各カード。`narration` と `minSeconds`。
- `chapters[].steps[]` — 実写パート（1 起動と音源 / 2 画面の読み方 / 3 素材を選ぶ / 4 決め場のロゴ）。ステップごとに
  `subtitle`（字幕）・`narration`・`minSeconds`・`actions`（撮影時の操作）・`notes`（描き込みの注釈）・`legend`（ステージ右上の説明カード）。
- ステップの長さ = `max(minSeconds, ナレーション + 1 s)`。この契約を `narration.mjs` → `capture.mjs` → 合成の 3 者で共有する。

`capture.mjs` の `actions`（`at` はステップ開始からの秒。負なら終了からの秒）:

| type | 例 | 内容 |
| --- | --- | --- |
| `click` | `button:Demo track` / `scene:hina_dan3d` / `button:ひな祭り` | クリック（リング表示 + tap 音） |
| `key` | `h` / `l` / `7` | キー入力（キーキャップのバッジ + pop 音） |
| `type` | `input:main` + `text` | テキスト入力欄に追記（末尾から） |
| `select` | `select:ロゴ メイン` + `value` / `select:pos` | `<select>` を選ぶ |
| `check` | `checkbox:ランダム切替` | チェックボックス |
| `scrollTo` | `section:Scenes` | パネルをそのセクションまでスクロール |
| `eval` | `window.vj.…` | ページ内 JS（`window.vj` で director / beat / logo を直接操作できる） |

`notes` は `target`（DOM 要素。撮影時に位置を追跡）か `box`（ステージ座標の固定枠。CLI ログなど canvas の内容用）。
`legend` は canvas に描かれるログを説明するためのカード（色見本 / バッジ + 説明文）。

## 撮影の仕掛け（アプリのソースは変えない）

- **1920×920 で撮る**: 合成では下 160 px を字幕帯（章チップ + 字幕 + 進捗）にする。ステージ下端の CLI ログとプロンプト行を字幕で隠さないため。
- **`#panel { zoom: 1.5 }`** をキャプチャ時だけ注入: 12 px のサイドパネルが 1080p で読めるように。
- **ヘッドレス Chromium を ANGLE/Metal で起動**（`--use-gl=angle --use-angle=metal`）: 実 GPU で three.js / GLSL のシーンも 60 fps。SwiftShader だと 1.5 fps しか出ない。
- **CDP screencast → ffmpeg**: コンポジタのフレームを JPEG で受けて 30 fps に載せ直し h264 に。Playwright の recordVideo（VP8 ~1 Mbps）は使わない。
- **Demo track を音声ベッドに**: クリック後、ページの AudioBuffer を読み出して `public/audio/demo-track.wav` に書き、
  `timeline.json` の `demo.startMs` から合成側で同期再生（ナレーション中はダッキング）。129.5 秒の曲より撮影が長いので、
  ページ側の `AudioBufferSourceNode.loop = true` と合成側の `loop` を揃えてループさせる。
- **Google Fonts を先読み**: アプリはフォントを選んだとき ~1.2 s しか待たない（`src/fonts.ts`）が、この回線では初回接続に ~3 s かかり「not found」になる。
  撮影前にパネルの候補フォント全部の stylesheet と woff2 をブラウザキャッシュに入れてからリロードし、その後で録画を始める。
- `/api/spotify` はスタブ（「osascript failed」の表示を出さない）。決め場ロゴは `l` で出したあと `eval` で `untilBar` を伸ばし、章の間ずっと出しておく。

## 合成（`remotion/`）

`Howto.tsx`: タイトル → 仕組み → 実写（4 章を 1 本の `app.mp4` で連続）→ キーボード早見 → URL を `@remotion/transitions` のフェードでつなぐ。
実写パートは `AppSegment.tsx`: 映像の上に描き込み注釈（`Callouts`）・クリックリング・キーバッジ・説明カード（`Legends`）・章スレート、
下に字幕帯（`CaptionBand`）。BGM（`bgm.wav`）はカードの下で鳴り、Demo track を押した瞬間からは実際のデモ曲に切り替わる。
フォントは `public/fonts/NotoSansJP.ttf` を `FontGate` で読み込んでから描く（フォールバック字形によるフレーム間の揺れを防ぐ）。
