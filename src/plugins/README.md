# ビジュアルのプラグイン

`src/plugins/` 以下に置いたファイルは起動時に自動で読み込まれ、シーン（素材）か FX（ポストエフェクト）になる。
実行中にファイルをステージへドロップしても追加できる。登録は `src/plugins/loader.ts`、Jev 向けのメタデータは `src/plugins/meta.ts`。

- シェーダーの **id** はファイル名のスラッグ（`neon-rings.glsl` → `neon_rings`。`@id` / `JEVJ.id` で上書き可）。TS / JS モジュールは定義の `id`。既存 id と重なると置き換わるので、固有の名前にする。
- 同梱の対象は `*.fs *.frag *.glsl *.isf`（シェーダー）と `*.scene.ts`（TS モジュール）。ドロップでは `.txt .js .mjs` も受け付ける。

## 形式と判定

シェーダーは拡張子ではなく中身で判定する（`detectShaderFormat`）。

| 判定 | 形式 | なるもの |
| --- | --- | --- |
| 先頭が `/*{`（JSON ヘッダー） | ISF | `inputImage`（TYPE `image`）入力があれば **FX**、なければシーン（グループ `isf`） |
| `void mainImage(` がある | Shadertoy | シーン（グループ `shadertoy`） |
| それ以外 | Jev GLSL | シーン（グループ `gl`） |
| `*.scene.ts` / `.js` / `.mjs` | モジュール | `render` を持てばシーン、`apply` を持てば FX |

どの形式も `#version` と `precision` 行は空行に置き換える（three.js の ShaderMaterial が GLSL ES 3.00 のプレフィックスを付ける。`gl_FragColor` と `texture2D` は `#define` 済みなので `texture()` と両方使える）。
GL 系は共有の WebGL2 キャンバスに 0.75 倍の解像度で描いて 2D ステージへ転写する。

### ISF（`.fs` / `.isf`）

`src/gl/isf.ts`。ISF v2（v1 の `PERSISTENT_BUFFERS` / `vv_FragNormCoord` も可）に対応する。

- 標準: `TIME TIMEDELTA FRAMEINDEX PASSINDEX RENDERSIZE DATE`、`isf_FragNormCoord`、`IMG_PIXEL / IMG_NORM_PIXEL / IMG_THIS_PIXEL / IMG_THIS_NORM_PIXEL / IMG_SIZE`。
- INPUTS: `float bool long event color point2D image audio audioFFT`。`audio` は波形、`audioFFT` はスペクトラムのテクスチャ。
- PASSES: `TARGET / PERSISTENT / FLOAT / WIDTH / HEIGHT`（`"$WIDTH/2"`、`floor()` などの式も可）。永続バッファでフィードバックが作れる。
- 非対応: トランジション（`startImage` / `endImage`、読み込むとエラー扱い）、カスタム頂点シェーダー、`IMPORTED` 画像（黒の 1x1 になり、コンソールに警告）。
- Jev の `uBass` などの uniform は ISF には無い。音は INPUTS とバインド経由で受け取る。

**Jev 拡張 `JEVJ` キー**（他の ISF ホストは無視する）:

```json
"JEVJ": {
  "short": "…。ブレイク",
  "maxBars": 16,
  "bind": { "zoom": "bass", "amt": { "src": "intensity", "min": 0.2, "max": 1 } },
  "palette": true
}
```

- `name / description / short / group / maxBars / id` は `NAME` / `DESCRIPTION` より優先される。
- `bind` のソース: `energy sub bass mid high beatPulse beatPhase barPhase intensity onset beat`。
  - float / long: `min..max`（省略時は入力の `MIN..MAX`）に写像。`long` に `VALUES` があれば、その中から選ぶ。
  - bool / event: 値が 0.5 を超えたら true。`beat` は拍の頭の 1 フレームだけ 1。
  - color: `"a" | "b" | "c" | "bg" | "default"`。
- バインドが無いときの既定:
  - color 入力は宣言順にパレットの a, b, c, bg になる（`"palette": false` で無効にし、DEFAULT を使う）。
  - event 入力は拍で発火する。
  - float は名前で推定する: `bass/kick/low` → bass、`high/treble/hat` → high、`mid` → mid、`level/volume/energy/loudness` → energy、`intensity` → intensity。

### Shadertoy（`mainImage`）

`src/gl/shadertoy.ts`。シングルパスのみ（Buffer A–D と Cube A は非対応）。

| uniform | 中身 |
| --- | --- |
| `iChannel0` | 音声 512x2。行 0（`y=0.25`）が FFT、行 1（`y=0.75`）が波形。Shadertoy のマイク / Soundcloud 入力と同じ並び |
| `iChannel1` | このシェーダー自身の前フレーム（フィードバック。Buffer A の代わり）。ソースに `iChannel1` があるときだけ確保する |
| `iChannel2` / `iChannel3` | 256x256 RGBA ノイズ |
| `iMouse` | xy は音に追従（x = 小節位相 × 幅、y = bass × 高さ）。z / w は常に 0（未クリック扱い） |
| その他 | `iResolution iTime iTimeDelta iFrame iFrameRate iDate iSampleRate iChannelResolution iChannelTime`、`HW_PERFORMANCE` は 0 |

Jev の uniform（`uBass uBeatPulse uIntensity uColA` など、下記）も宣言済みなので、貼り付けた Shadertoy をそのまま動かしてから、パレットやビートへ 1〜2 行で結び付けられる。出力のアルファは 1 に固定される。

### Jev GLSL（`.frag` / `.glsl`）

`src/gl/shaders/common.glsl` が前に付く。`void main()` で `gl_FragColor` に書く。

- uniform: `uTime uEnergy uSub uBass uMid uHigh uBeatPhase uBeatPulse uBarPhase uBeat uOnset uIntensity uBar uBpm`、`uRes`（vec2）、`uColA uColB uColC uColBg`（vec3、パレット）、`uFFT uWave`（512x1 テクスチャ）
- ヘルパー: `fft(x)`（0..1 ≒ 0..11 kHz の振幅）、`wav(x)`（-1..1）、`hash1(p) hash2(p) noise(p) fbm(p) rot(a)`

### TS / JS モジュール（`*.scene.ts`、ドロップした `.js`）

`src/plugins/api.ts` のヘルパーで作り、`default`（単体か配列）、または `scenes` / `effects` を export する。

| ヘルパー | 用途 |
| --- | --- |
| `defineCanvasScene({ …meta, render(ctx, input), reset? })` | Canvas 2D。毎フレーム画面全体を描く。グループ既定 `2d` |
| `defineThreeScene({ …meta, fov?, setup(s) → { update(input, s), reset? } })` | three.js。`s` に `THREE scene camera renderer uniforms`（自作 ShaderMaterial 用の音声 uniform）。背景色はパレットの bg。グループ既定 `gl` |
| `defineGlslScene({ …meta, frag })` | Jev GLSL を TS から定義する |
| `defineCanvasEffect({ id, name, description, short?, apply(ctx, input, amount), reset? })` | 完成したステージへの 2D ポストエフェクト。`amount` は 0..1 |

`input`（`RenderInput`、`src/types.ts`）: `t dt w h`、`energy sub bass mid high`、`beatPulse beatPhase barPhase onset`、`beat bar bpm`、`intensity`（0..1、Jev の判断）、`palette {bg,a,b,c}`、`wave`（Float32Array）、`spectrum`（Uint8Array 1024 ビン）。

**実行時の `.js`** は `three` を import できないので、`globalThis.JEVJ` に同じヘルパー（`JEVJ.THREE` を含む）がある。`export default` するか、`JEVJ.register(sceneOrEffect)` を呼ぶ。ドロップしたものは id に `user_` が付き、グループ `user` になる。

## メタデータと Jev

GLSL / Shadertoy はファイル先頭 40 行のコメントタグで書く。ISF は `NAME` / `DESCRIPTION` と `JEVJ`、TS は定義オブジェクトに書く。

```glsl
// @name Neon Rings
// @description 同心円のネオンリングがスペクトラムで揺れ、キックで外へ押し出される。…ドロップに合う
// @short ネオンの同心円（Shadertoy）。クラブ感。安定・ドロップ
// @group shadertoy
// @maxBars 8
```

- `@short`（30 字前後）を **Jev が読む**。見た目、ムード、合う曲の場面の順に書き、最後を「…。ビルド・ドロップ」のように場面で締める。既存シーンと場面やムードが重ならないようにすると選ばれ方がばらける。
- `@short` が無いと `@description` の最初の文（「。」まで）を使う。`@description` は人向けで、ピッカーのツールチップに出る。
- `@maxBars`: このシーンに留まれる上限の小節数（既定 32）。ストロボのように短く使うものは小さくする。
- FX も同じく `short`（無ければ `description` の最初の文）が Jev の FX 候補の判断材料になる。
- Jev はシーンの切り替えと一緒に、intensity（0..1）とパレット（warm / cold / neon / mono / acid / hina）を選ぶ。色は必ずパレットから取り、intensity が低いときは静かに見えるようにする。

## FX のモード

パネルの FX 一覧で、FX ごとにモードを選ぶ（`EffectMode`、`src/ui.ts`）。複数の FX を同時に有効にでき、一覧の順に重なる。

| モード | 効き方 |
| --- | --- |
| `off` | 使わない |
| `jev (AI)` | Jev の合議が、このモードの FX から 1 つ（または「なし」）を選ぶ。切り替えは約 1 小節でフェードし、強さは intensity とビートで決まる |
| `auto` | intensity 0.3〜0.8 に比例して効く |
| `beat` | `beatPulse` で拍ごとに効く（強さは intensity で変わる） |
| `on` | 常に全量で効く |

モードは localStorage の `jev-vj.fx` に保存される。

## ドロップと保存

- `.fs .frag .glsl .isf .txt .js .mjs` をページのどこかにドロップするか、「シェーダー / プラグインを追加…」で選ぶ。音声ファイルなら再生する。
- 追加したファイルはソースごと localStorage の `jev-vj.plugins` に保存され、リロード後に復元される。同じファイル名で再ドロップすると置き換わる。容量を超えるとログに出て、その回限りになる。
- `user` グループのシーンは × ボタンで削除できる。
- `JEVJ.register()` で登録したものは保存されない。

## エラー処理

- 起動後、アイドル時間にすべての GL シーンと FX を先にコンパイルする（`prewarm`）。初めて切り替えたときに止まらず、壊れたものは Jev に選ばれる前に除外される。
- コンパイルエラーはログに出て、ピッカーではシーンが「broken」表示になる（ツールチップに内容）。行番号は元ファイルの行に対応させて出す（ISF は JSON ヘッダーの行数も含む）。
- 描画中に例外を投げたシーンや FX は `error` が立ち、ディレクターが別のシーンに切り替える。フレームループは止まらない。
- 同梱ファイルの読み込み失敗（ISF ヘッダーの JSON エラーなど）は起動を止めず、そのファイルだけ除外される。

## パフォーマンス

目標はノート PC の GPU で 1080p・60fps（GL は 0.75 倍で描く）。

- レイマーチは 80 ステップ以下。重いループや大きな `fbm` の重ね掛けは避ける。
- ISF のマルチパスは必要な分だけにする。半解像度（`"WIDTH": "$WIDTH/2"`）のバッファが効く。
- Shadertoy は `iChannel1` を参照するとフィードバック用バッファが 2 枚増える。
- Canvas 2D は 1 フレームに数千回のパス操作をしない。パスはまとめ、パターンやグラデーションはサイズごとにキャッシュする。
- three.js は `InstancedMesh` を使い、`update` の中で毎フレーム new しない（Color / Vector / Matrix は `setup` で作って使い回す）。
- 残像は、薄い bg で `fillRect` するフェードで作る。フェードが弱すぎると 8bit 精度で消え残るので、拍ごとに強めに消す。

## テンプレート

### ISF ジェネレーター（`isf/my-glow.fs`）

```glsl
/*{
  "ISFVSN": "2",
  "NAME": "My Glow",
  "DESCRIPTION": "中央の光がキックで広がる。静かで温かい。イントロやブレイクダウンに合う",
  "INPUTS": [
    { "NAME": "colA", "TYPE": "color", "DEFAULT": [1, 0.5, 0.2, 1] },
    { "NAME": "colBg", "TYPE": "color", "DEFAULT": [0, 0, 0, 1] },
    { "NAME": "bass", "TYPE": "float", "DEFAULT": 0, "MIN": 0, "MAX": 1 },
    { "NAME": "level", "TYPE": "float", "DEFAULT": 0.5, "MIN": 0, "MAX": 1 },
    { "NAME": "fftTex", "TYPE": "audioFFT" }
  ],
  "JEVJ": { "short": "中央の光が脈打つ。静か。イントロ・ブレイク", "bind": { "level": "intensity", "colBg": "bg" } }
}*/
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * RENDERSIZE) / RENDERSIZE.y;
  float hi = IMG_NORM_PIXEL(fftTex, vec2(0.6, 0.5)).r;
  float g = 0.02 * (0.3 + level + bass) / (length(p) + 0.02) + hi * 0.1;
  gl_FragColor = vec4(mix(colBg.rgb, colA.rgb, clamp(g, 0.0, 1.0)), 1.0);
}
```

color 入力は宣言順に a, b, c, bg へ割り当てられるので、2 番目の `colBg` はそのままだと b になる。上のように `"colBg": "bg"` と明示する。`bass` は名前からの推定で bass に追従する。

### ISF フィルター → FX（`isf/my-shift.fs`）

```glsl
/*{
  "ISFVSN": "2",
  "NAME": "My Shift",
  "DESCRIPTION": "画面を横にずらす。ビートで揺れる。ドロップに",
  "INPUTS": [
    { "NAME": "inputImage", "TYPE": "image" },
    { "NAME": "amt", "TYPE": "float", "DEFAULT": 0, "MIN": 0, "MAX": 0.05 }
  ],
  "JEVJ": { "short": "横ずれ。ビートで揺れる。ドロップ", "bind": { "amt": "beatPulse" } }
}*/
void main() {
  vec2 uv = isf_FragNormCoord;
  uv.x += amt * sin(uv.y * 40.0 + TIME * 10.0);
  gl_FragColor = IMG_NORM_PIXEL(inputImage, fract(uv));
}
```

### Shadertoy（`shadertoy/my-bars.glsl`）

```glsl
// @name My Bars
// @description スペクトラムの縦棒。…テクノの安定進行に合う
// @short スペクトラムの縦棒（Shadertoy）。硬質。安定進行
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float f = texture(iChannel0, vec2(floor(uv.x * 32.0) / 32.0, 0.25)).x;
  vec3 col = mix(uColBg, mix(uColA, uColB, uv.y), step(uv.y, f * (0.4 + 0.6 * uIntensity)));
  fragColor = vec4(col + uBeatPulse * 0.1 * uColC, 1.0);
}
```

### Jev GLSL（`glsl/my-rings.frag`）

```glsl
// @name My Rings
// @description 同心円がスペクトラムで波打つ。…ミニマルに合う
// @short スペクトラムで波打つ同心円（GLSL）。ミニマル・安定
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float r = length(p);
  float v = smoothstep(0.02, 0.0, abs(fract(r * 6.0 - uTime * 0.2) - 0.5) - fft(r) * 0.2);
  vec3 col = mix(uColBg, mix(uColA, uColB, r), v * (0.3 + 0.7 * uIntensity)) + uBeatPulse * 0.15 * uColC;
  gl_FragColor = vec4(col, 1.0);
}
```

### Canvas 2D（`canvas/my-dots.scene.ts`）

```ts
import { defineCanvasScene } from '../api';

export default defineCanvasScene({
  id: 'my_dots',
  name: 'My Dots',
  description: 'スペクトラムの点が横に並ぶ。…ブレイクに合う',
  short: 'スペクトラムの点列。軽やか。ブレイク',
  render(ctx, { w, h, palette, spectrum, intensity, beatPulse }) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = palette.a;
    ctx.beginPath();
    for (let i = 0; i < 64; i++) {
      const v = spectrum[i * 8]! / 255;
      const r = 2 + v * 20 * (0.4 + intensity) + beatPulse * 6;
      ctx.moveTo((i + 0.5) * (w / 64) + r, h / 2);
      ctx.arc((i + 0.5) * (w / 64), h / 2, r, 0, Math.PI * 2);
    }
    ctx.fill();
  },
});
```

### three.js（`three/my-cube.scene.ts`）

```ts
import { defineThreeScene } from '../api';

export default defineThreeScene({
  id: 'my_cube',
  name: 'My Cube (three.js)',
  description: 'ワイヤーの立方体が回転し、キックで膨らむ。…ビルドに合う',
  short: 'ワイヤー立方体が回る（3D）。ビルド',
  setup({ THREE, scene, camera }) {
    const mat = new THREE.MeshBasicMaterial({ wireframe: true });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    scene.add(cube);
    camera.position.set(0, 0, 3);
    return {
      update(input) {
        mat.color.set(input.palette.a);
        cube.rotation.y += input.dt * (0.2 + input.intensity);
        cube.scale.setScalar(1 + input.beatPulse * 0.3);
      },
    };
  },
});
```

### Canvas FX（`canvas/fx-my-dim.scene.ts`）

```ts
import { defineCanvasEffect } from '../api';

export default defineCanvasEffect({
  id: 'my_dim',
  name: 'My Dim',
  description: '拍ごとに画面を暗く沈める。ブレイクに',
  short: '拍で暗転。ブレイク',
  apply(ctx, input, amount) {
    ctx.globalAlpha = amount * input.beatPulse * 0.6;
    ctx.fillStyle = input.palette.bg;
    ctx.fillRect(0, 0, input.w, input.h);
  },
});
```

### 実行時 `.js`（ステージにドロップ）

```js
const { defineCanvasScene } = globalThis.JEVJ;
export default defineCanvasScene({
  id: 'flash_box',
  name: 'Flash Box',
  description: '中央の四角がビートで光る。ドロップに',
  short: '中央の四角が光る。ドロップ',
  render(ctx, { w, h, palette, beatPulse }) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = palette.a;
    const s = Math.min(w, h) * (0.2 + beatPulse * 0.2);
    ctx.fillRect((w - s) / 2, (h - s) / 2, s, s);
  },
});
```
