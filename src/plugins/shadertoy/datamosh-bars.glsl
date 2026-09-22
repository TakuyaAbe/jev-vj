// @name Datamosh Bars
// @description バーコード状の縞とブロック単位で崩れた前フレームが帯ごとに入れ替わる、壊れたデータのようなグリッチ。ビートごとに配置が組み替わり、キックでブロックがずれて色がにじむ。硬く攻撃的でデジタルな暴力性。ハードなドロップやブレイクコア、インダストリアルの激しい瞬間に合う
// @short 崩れるバーコードとデータモッシュ。攻撃的・破壊。ハードドロップ
// @maxBars 8
// Shadertoy-compatible: iChannel0 = music input, iChannel1 = this shader's previous frame (feedback).

float dmHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float busy = uIntensity;
  // the layout reshuffles every beat (every 16th when the track is busy)
  float seed = floor(uBeat) + floor(uBeatPhase * 4.0) * 0.25 * step(0.6, busy);
  float rows = floor(mix(5.0, 22.0, dmHash(vec2(seed, 1.0))));
  float rowId = floor(uv.y * rows);
  float kind = dmHash(vec2(rowId, seed));

  // block-wise displacement of the previous frame (the "mosh")
  vec2 blk = floor(fragCoord / (18.0 + 30.0 * dmHash(vec2(seed, 7.0))));
  vec2 disp = (vec2(dmHash(blk + seed), dmHash(blk - seed)) - 0.5) * 0.035 * (0.15 + uBeatPulse * (0.4 + busy));
  disp.y -= 0.002;
  float split = 0.002 + uBeatPulse * 0.008 * busy;
  vec3 prev;
  prev.r = texture(iChannel1, uv + disp + vec2(split, 0.0)).r;
  prev.g = texture(iChannel1, uv + disp).g;
  prev.b = texture(iChannel1, uv + disp - vec2(split, 0.0)).b;
  prev *= 0.93 - 0.08 * (1.0 - busy);

  vec3 col = prev;
  float amp = texture(iChannel0, vec2(uv.x * 0.6, 0.25)).x;
  // on some beats the barcode rows flip to negative (per beat, not per frame, and never fed back as a flicker)
  float neg = step(0.5, busy) * step(0.6, dmHash(vec2(seed, 9.0)));
  if (kind < 0.12 + 0.3 * busy) {
    // barcode: bar widths from a hash, brightness from the spectrum under it
    float n = floor(mix(40.0, 160.0, dmHash(vec2(rowId, seed + 3.0))));
    float cell = floor(uv.x * n);
    float on = step(0.45, dmHash(vec2(cell, rowId + seed * 13.0)));
    vec3 c = dmHash(vec2(cell, seed)) > 0.7 ? uColC : mix(uColA, uColB, dmHash(vec2(rowId, 5.0)));
    on = mix(on, 1.0 - on, neg);
    col = mix(uColBg, c, on * (0.25 + amp * 1.1));
  } else if (kind > 0.93 - 0.1 * busy) {
    // scope strip: the waveform drawn as a hard line on black
    float yIn = fract(uv.y * rows);
    float w = texture(iChannel0, vec2(uv.x, 0.75)).x;
    float line = smoothstep(0.08, 0.0, abs(yIn - w));
    col = uColBg + uColA * line * 1.2;
  }
  col += uColC * uBeatPulse * 0.05 * busy;
  // sparse horizontal tear lines
  col += uColB * step(0.995, dmHash(vec2(floor(fragCoord.y), seed))) * 0.6;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
