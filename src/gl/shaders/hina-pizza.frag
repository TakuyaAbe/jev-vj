// hina pizza: key visual for "bakuro domino club presents HINAMATSURI", low-poly toy style.
// A top-down 16-gon pizza (one hishimochi, salami and basil leaf per slice, one slice
// pulled out) next to a three-tier red hina-dan, over a dark triangle mesh. Every shape
// is a flat-shaded facet lit from the upper left.
//
// Everything is laid out in "design px": a 1080 x 1080 square, origin top-left, y down,
// fitted to the short side of the viewport and centred. kv.ts draws the typography on
// top of the same square, so the tier geometry below is mirrored there (DAN_*).
// All time-driven motion repeats after LOOP seconds, so a LOOP-second capture loops.

#define CUTE_FACES 1 // two dot eyes on every hishimochi

// 1 = leave the pizza out (kv.ts composites a 3D render there instead). Unset uniforms read
// as 0, so the VJ scene draws the pizza without knowing about this.
uniform float uHidePizza;
// How far each shader-drawn layer is faded out in the KV: x = hina-dan (blocks, shadow,
// streaks), y = petals, z = background mesh. 0 = fully visible, 1 = gone, so the unset
// uniform leaves the VJ scene as it is.
uniform vec4 uLayerHide;
// Entrance of the hina-dan in the KV: per-tier x offset in design px (top, middle, bottom)
// and how strongly each tier trails speed streaks (0..1). Both are 0 in the VJ scene.
uniform vec3 uDanX;
uniform vec3 uDanStreak;
// (x of the top tier's centre, top y, scale) of the hina-dan; all 0 = the DAN_* defaults (VJ scene)
uniform vec3 uDanGeo;
// (alignment 0 left .. 0.5 centred .. 1 right, step width, shear); only read when uDanGeo.z > 0
uniform vec3 uDanShape;

const float PI = 3.14159265;
const float TAU = 6.28318531;
const float LOOP = 10.0;

const vec3 BG = vec3(0.102, 0.063, 0.078);
const vec3 PINK_PALE = vec3(1.0, 0.761, 0.831);
const vec3 PINK_MID = vec3(1.0, 0.624, 0.749);
const vec3 PINK = vec3(1.0, 0.69, 0.784);
const vec3 PINK_HOT = vec3(1.0, 0.478, 0.635);
const vec3 RED = vec3(0.784, 0.063, 0.18);
const vec3 RED_D = vec3(0.541, 0.043, 0.125);
const vec3 GOLD = vec3(0.902, 0.769, 0.353);
const vec3 GOLD_D = vec3(0.788, 0.631, 0.247);
const vec3 GOLD_DD = vec3(0.541, 0.416, 0.11);
const vec3 CREAM = vec3(1.0, 0.953, 0.839);
const vec3 GREEN = vec3(0.639, 0.827, 0.612);
const vec3 BASIL = vec3(0.369, 0.62, 0.341);

const vec2 PIZZA_C = vec2(790.0, 720.0);
const float PIZZA_R = 296.0; // apothem of the 16-gon
const float CRUST_W = 48.0;
const float SAUCE_W = 9.0;
const float PULLED = 1.0; // slice index, centred at 1:30

// hina-dan: a stepped pyramid seen from the front, every tier centred on one axis (keep in
// sync with DAN_GEO in src/kv.ts). Sizes are in the dan's own px, before DAN_S / uDanGeo.z.
const float DAN_AX = 250.0; // x of the top tier's centre (the axis, when centred)
const float DAN_Y = 570.0; // top of the top tread
const float DAN_S = 0.8; // overall scale
const float DAN_TIER_H = 146.0;
const float DAN_TREAD_H = 40.0;
const float DAN_W0 = 284.0; // width of the top tier
const float DAN_STEP = 44.0; // each tier is this much wider on both sides
const float DAN_TREAD_INSET = 14.0; // the tread narrows this much toward the back

float gPx; // design px per device pixel (antialiasing width)
vec2 gL; // light direction on screen (points toward the light, upper left)

float cover(float d) { return 1.0 - smoothstep(-0.75 * gPx, 0.75 * gPx, d); }

// regular n-gon with apothem rad, a flat side facing up; j = side index, clockwise from the top
float sdNgon(vec2 p, float n, float rad, out float j) {
  float seg = TAU / n;
  float fa = atan(p.x, -p.y) / seg + 0.5;
  j = floor(fa);
  return length(p) * cos((fract(fa) - 0.5) * seg) - rad;
}

// flattened diamond, approximate px distance
float sdDiamond(vec2 p, vec2 b) {
  return (abs(p.x) / b.x + abs(p.y) / b.y - 1.0) * (b.x * b.y / length(b));
}

// 4-vertex kite, pointed along y, widest below the middle
float sdKite(vec2 p, float len) {
  p.y = p.y > 0.0 ? p.y * 1.5 : p.y * 0.8;
  return sdDiamond(p, vec2(len * 0.62, len));
}

// per-triangle hash on an equilateral mesh
float triHash(vec2 p, float size) {
  vec2 g = vec2(p.x - p.y * 0.57735, p.y * 1.1547) / size;
  vec2 i = floor(g);
  vec2 f = fract(g);
  return hash1(i * 1.37 + step(1.0, f.x + f.y) * vec2(0.31, 0.73) + 0.17);
}

// The toppings take d in screen-aligned px so their side faces and shadows all fall the same way.

// chunky octagon: dark side wall, 8 flat-shaded bevel facets, lighter top facet
void salami(inout vec3 col, vec2 d, float rad) {
  float j;
  col = mix(col, col * 0.62, cover(sdNgon(d - vec2(5.0, 12.0), 8.0, rad, j)));
  float side = min(sdNgon(d - vec2(0.0, 7.0), 8.0, rad, j), max(abs(d.x) - rad, abs(d.y - 3.5) - 3.5));
  col = mix(col, vec3(0.78, 0.26, 0.45), cover(side));
  float top = sdNgon(d, 8.0, rad, j);
  float a = j * TAU / 8.0;
  float lit = dot(vec2(sin(a), -cos(a)), gL);
  vec3 bevel = mix(vec3(0.90, 0.36, 0.54), vec3(1.0, 0.62, 0.74), 0.5 + 0.5 * lit);
  col = mix(col, bevel, cover(top));
  col = mix(col, mix(PINK_HOT, PINK_PALE, 0.42), cover(sdNgon(d, 8.0, rad * 0.62, j)));
}

// two-facet kite leaf: the half facing the light is pale, the other is basil green
void basil(inout vec3 col, vec2 d, float len, float ang) {
  mat2 Rm = rot(ang);
  col = mix(col, col * 0.66, cover(sdKite(Rm * (d - vec2(3.0, 6.0)), len)));
  vec2 k = Rm * d;
  float lit = dot(vec2(Rm[0][0], Rm[1][0]) * sign(k.x), gL);
  vec3 lc = lit > 0.0 ? mix(GREEN, CREAM, 0.18) : BASIL;
  col = mix(col, lc, cover(sdKite(k, len)));
}

// three stacked diamond slabs (green / white / pink from the bottom) with lit left and
// shaded right side faces
void mochi(inout vec3 col, vec2 d) {
  vec2 b = vec2(33.0, 14.0);
  float hh = 9.0; // slab height
  col = mix(col, col * 0.6, cover(sdDiamond(d - vec2(6.0, hh * 2.0 + 9.0), b)));
  for (int i = 0; i < 3; i++) {
    float off = hh - hh * float(i);
    vec3 lc = i == 0 ? GREEN : (i == 1 ? vec3(1.0, 0.975, 0.93) : PINK);
    float side = min(sdDiamond(d - vec2(0.0, off + hh), b), max(abs(d.x) - b.x, abs(d.y - off - hh * 0.5) - hh * 0.5));
    float sideLit = 0.72 + 0.12 * dot(vec2(sign(d.x) * 0.7, 0.7), -gL);
    col = mix(col, lc * sideLit, cover(side));
    col = mix(col, mix(lc, vec3(1.0), 0.18), cover(sdDiamond(d - vec2(0.0, off), b)));
  }
#if CUTE_FACES
  vec2 e = vec2(abs(d.x) - 8.0, d.y + hh + 0.5);
  col = mix(col, vec3(0.36, 0.13, 0.22), cover(length(e) - 2.6));
#endif
}

// The pizza in its own frame (px from the centre). rgb + coverage; idx = slice 0..7.
vec4 pizza(vec2 p, mat2 toScreen, out float idx) {
  float r = length(p);
  float a = atan(p.x, -p.y); // clockwise from 12 o'clock
  float s = (a + PI / 8.0) / (PI / 4.0);
  idx = mod(floor(s), 8.0);
  float cutD = r * sin((0.5 - abs(fract(s) - 0.5)) * PI / 4.0); // px to the nearest cut
  // 16-gon outline: two crust facets per slice, vertices on the cuts
  float fa = (a + PI / 8.0) / (PI / 8.0);
  float fj = floor(fa);
  float dP = r * cos((fract(fa) - 0.5) * PI / 8.0);
  float alpha = cover(dP - PIZZA_R) * smoothstep(1.8, 1.8 + 1.5 * gPx, cutD);
  if (alpha <= 0.0) return vec4(0.0);

  // cheese: big flat triangles, each with its own tone and a slight tilt toward / away from the light
  float h = triHash(p, 84.0);
  vec2 tilt = vec2(cos(h * TAU), sin(h * TAU));
  vec3 col = mix(CREAM, vec3(1.0, 0.89, 0.66), fract(h * 7.13)) * (0.97 + 0.06 * dot(toScreen * tilt, gL));
  col += vec3(1.0, 0.95, 0.85) * uHigh * 0.12 * step(0.8, fract(h * 3.7 + uBeat * 0.37));

  // toppings: one of each per slice, mirrored on every other slice
  float ac = idx * PI / 4.0;
  vec2 e = vec2(sin(ac), -cos(ac)); // outward along the slice
  vec2 n = vec2(cos(ac), sin(ac)) * (mod(idx, 2.0) < 0.5 ? 1.0 : -1.0);
  vec2 hj = hash2(vec2(idx, 7.0));
  salami(col, toScreen * (p - (-33.0 * n + 206.0 * e)), 28.0);
  basil(col, toScreen * (p - (40.0 * n + 186.0 * e)), 27.0, ac + 0.5 + 1.6 * hj.x);
  mochi(col, toScreen * (p - 118.0 * e));

  // sauce ring, then the crust: inner bevel, flat top, outer bevel, shaded per facet
  float inner = PIZZA_R - CRUST_W;
  col = mix(col, RED, 1.0 - cover(dP - (inner - SAUCE_W)));
  float aj = (fj + 0.5) * PI / 8.0 - PI / 8.0;
  float lit = dot(toScreen * vec2(sin(aj), -cos(aj)), gL);
  float fh = hash1(vec2(fj, 2.3));
  vec3 topC = mix(GOLD, CREAM, 0.2) * (0.96 + 0.08 * fh);
  vec3 outC = mix(mix(GOLD_DD, GOLD_D, 0.4), mix(GOLD, PINK_PALE, 0.3), 0.5 + 0.5 * lit);
  vec3 inC = mix(mix(GOLD_DD, GOLD_D, 0.4), GOLD, 0.5 - 0.5 * lit);
  vec3 crust = dP > PIZZA_R - 16.0 ? outC : (dP > inner + 13.0 ? topC : inC);
  crust += GOLD * uBeatPulse * 0.3; // gold lights up on the beat
  col = mix(col, crust, 1.0 - cover(dP - inner));
  return vec4(col, alpha);
}

// mask of the pulled slice (for its drop shadow)
float sliceShadow(vec2 p) {
  float r = length(p);
  float s = (atan(p.x, -p.y) + PI / 8.0) / (PI / 4.0);
  if (abs(mod(floor(s), 8.0) - PULLED) > 0.5) return 0.0;
  float cutD = r * sin((0.5 - abs(fract(s) - 0.5)) * PI / 4.0);
  return smoothstep(0.0, 14.0, cutD) * smoothstep(PIZZA_R + 4.0, PIZZA_R - 12.0, r);
}

// Three centred blocks, narrowest on top: dark front face with a gold bevel, and above it the
// lit tread running back to the tier above. `streak` returns additive light: thin gold / red
// speed lines trailing a tier that is sliding in.
vec4 dan(vec2 q0, out float shadow, out vec3 streak) {
  vec4 o = vec4(0.0);
  shadow = 0.0;
  streak = vec3(0.0);
  bool custom = uDanGeo.z > 0.0;
  float S = custom ? uDanGeo.z : DAN_S;
  vec2 org = custom ? uDanGeo.xy : vec2(DAN_AX, DAN_Y);
  float align = custom ? uDanShape.x : 0.5;
  float stepW = custom ? uDanShape.y : DAN_STEP;
  float shear = custom ? uDanShape.z : 0.0;
  // the tread only narrows toward the back on a side that actually steps out
  float inL = DAN_TREAD_INSET * clamp(2.0 * align * stepW / 20.0, 0.0, 1.0);
  float inR = DAN_TREAD_INSET * clamp(2.0 * (1.0 - align) * stepW / 20.0, 0.0, 1.0);
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    float dx = i == 0 ? uDanX.x : (i == 1 ? uDanX.y : uDanX.z);
    float sk = i == 0 ? uDanStreak.x : (i == 1 ? uDanStreak.y : uDanStreak.z);
    vec2 q = (q0 - org - vec2(dx, 0.0)) / S; // the dan's own px: x from the top tier's centre, y from the top
    q.x += shear * (q.y - 1.5 * DAN_TIER_H); // lean the whole stack about its mid height
    float yT = k * DAN_TIER_H;
    float yF = yT + DAN_TREAD_H;
    float yB = yT + DAN_TIER_H;
    float hw = 0.5 * DAN_W0 + k * stepW;
    q.x -= k * stepW * (1.0 - 2.0 * align); // this tier's centre: lower tiers grow left, right or both
    vec2 sq = q - vec2(12.0, 16.0);
    float sd = max(abs(sq.x) - hw, max(yT - sq.y, sq.y - yB));
    shadow = max(shadow, smoothstep(26.0, -8.0, sd));
    float rows = (q.y - yT) / 5.0;
    float h = hash1(vec2(floor(rows), k * 7.3 + 1.0));
    float line = step(0.62, h) * smoothstep(0.5, 0.2, abs(fract(rows) - 0.5));
    vec3 lineCol = mix(RED * 1.4, GOLD, step(0.5, fract(h * 5.3)));
    if (sk > 0.0 && q.x < -hw + 8.0 && q.y > yT && q.y < yB) {
      // rows of different length and colour, fading out behind the block
      float len = 120.0 + 520.0 * fract(h * 9.7);
      float fade = exp(-(-hw - q.x) / len) * smoothstep(-hw + 8.0, -hw - 6.0, q.x);
      streak += lineCol * line * fade * sk;
    }
    // tread: a trapezoid, a little narrower and darker toward the back
    float u = (yF - q.y) / DAN_TREAD_H;
    float dT = max(max(-(hw - inL * u) - q.x, q.x - (hw - inR * u)), max(yT - q.y, q.y - yF - 1.0));
    vec3 tread = mix(RED, PINK_HOT, 0.3) * (1.06 - 0.16 * u) * (1.0 + 0.1 * dot(vec2(0.0, -1.0), gL)) + GOLD * 0.12 * uBeatPulse;
    o = mix(o, vec4(tread, 1.0), cover(dT * S));
    // front face: facets a shade apart, mirrored about the axis; gold bevel along the top
    float dF = max(abs(q.x) - hw, max(yF - q.y, q.y - yB));
    float diag = abs(q.x) / hw - (q.y - yF) / (yB - yF);
    vec3 front = RED_D * (diag > 0.0 ? 0.88 : 1.0);
    front = mix(front, mix(GOLD, CREAM, 0.15) * (1.0 + 0.5 * uBeatPulse), cover((q.y - yF - 5.0) * S));
    o = mix(o, vec4(front, 1.0), cover(dF * S));
    // the same rows smear across the moving block itself, so the speed reads before its tail is in frame
    if (sk > 0.0 && q.y > yT && q.y < yB && abs(q.x) < hw) o.rgb += lineCol * line * sk * 0.35 * o.a;
  }
  return o;
}

void main() {
  float S = min(uRes.x, uRes.y);
  gPx = 1080.0 / S;
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) * gPx;
  q.y = -q.y;
  q += 540.0;
  // on a wide stage (VJ) push the dan left and the pizza right into the spare room
  float wide = max(uRes.x / uRes.y - 1.0, 0.0) * 540.0;
  float ph = TAU * uTime / LOOP;
  // light from the upper left; in VJ mode it wobbles so the facets re-light on the beat
  gL = rot(uIntensity * (0.7 * uBeatPulse + 0.35 * sin(ph))) * normalize(vec2(-0.6, -0.8));

  // background: dark triangle mesh, each triangle slowly breathing a few percent
  float bh = triHash(q + vec2(wide, 0.0), 150.0);
  float bv = sin(bh * TAU + ph * (1.0 + floor(fract(bh * 5.3) * 2.0)));
  vec3 col = BG + vec3(0.024, 0.014, 0.019) * bv * (1.0 + 0.8 * uBeatPulse * uIntensity) * (1.0 - uLayerHide.z);

  // hina-dan
  float dShadow;
  vec3 dStreak;
  vec4 dn = dan(q + vec2(wide * 0.55, 0.0), dShadow, dStreak);
  float danShow = 1.0 - uLayerHide.x;
  dn.a *= danShow;
  col *= 1.0 - 0.45 * dShadow * danShow;
  col += dStreak * (1.0 - dn.a) * danShow;
  col = mix(col, dn.rgb, dn.a);

  if (uHidePizza < 0.5) {
    // pizza: sways (more when the music is intense), breathes with the bass
    vec2 pc = q - PIZZA_C - vec2(wide * 0.25, 0.0);
    float sway = (0.05 + 0.22 * uIntensity) * sin(ph);
    mat2 M = rot(sway);
    mat2 Mi = rot(-sway);
    col *= 1.0 - 0.5 * smoothstep(PIZZA_R + 44.0, PIZZA_R - 10.0, length(pc - vec2(12.0, 18.0))); // soft drop shadow
    vec2 pr = M * pc / (1.0 + 0.012 * sin(2.0 * ph) + 0.03 * uBass * uIntensity);
    float idx;
    vec4 pz = pizza(pr, Mi, idx);
    if (abs(idx - PULLED) < 0.5) pz.a = 0.0;
    col = mix(col, pz.rgb, pz.a);

    // the pulled slice: bobs slowly, pops on the beat
    float pull = 60.0 + 6.0 * sin(2.0 * ph + 1.0) + 30.0 * uBeatPulse;
    vec2 pp = pr - vec2(0.7071, -0.7071) * pull;
    col *= 1.0 - 0.5 * sliceShadow(pp - M * vec2(8.0, 13.0));
    float idx2;
    vec4 sl = pizza(pp, Mi, idx2);
    if (abs(idx2 - PULLED) > 0.5) sl.a = 0.0;
    col = mix(col, sl.rgb, sl.a);
  }

  // peach petals: two-tone kites drifting down; each wraps a whole number of times per LOOP
  float spanX = 1080.0 + 2.0 * wide + 160.0;
  for (int i = 0; i < 9; i++) {
    vec2 h = hash2(vec2(float(i), 3.7));
    float laps = 1.0 + step(0.75, h.x);
    float y = mod(h.y * 1300.0 + uTime / LOOP * 1300.0 * laps, 1300.0) - 110.0;
    float x = 540.0 + (h.x - 0.5) * spanX + 70.0 * sin(ph * 2.0 + h.y * TAU) - 0.12 * y;
    float size = 17.0 + 11.0 * fract(h.x * 7.3);
    vec2 d = rot(TAU * h.y + ph * (1.0 + floor(h.x * 3.0))) * (q - vec2(x, y));
    d.x /= 0.45 + 0.55 * abs(cos(ph * 2.0 + h.x * TAU)); // flutter
    vec3 pcol = d.x < 0.0 ? PINK_PALE : PINK_MID;
    col = mix(col, pcol, cover(sdKite(d, size)) * (1.0 - 0.85 * dn.a) * (1.0 - uLayerHide.y)); // keep the line-up tiers clear
  }

  col += GOLD * 0.03 * uBeatPulse;
  col *= 0.94 + 0.06 * uEnergy;
  gl_FragColor = vec4(col, 1.0);
}
