import * as THREE from 'three';
import type { Scene } from '../types';
import { GlContext } from './context';
import { AudioTextures, noiseTexture } from './audio-texture';
import { copyTexture, FULLSCREEN_VERT, fullscreenCamera, fullscreenScene, makeTarget } from './fullscreen';
import { makeAudioUniforms, updateAudioUniforms, type BeatCounter } from './uniforms';
import { SOURCE_END, sourceStart, stripDirectives, type PluginMeta } from '../plugins/meta';

/**
 * Shadertoy-compatible single-pass shaders (`void mainImage(out vec4, in vec2)`).
 *
 *   iResolution iTime iTimeDelta iFrame iFrameRate iMouse iDate iSampleRate
 *   iChannelResolution[4] iChannelTime[4]
 *   iChannel0  audio: 512x2, row 0 = FFT, row 1 = waveform (Shadertoy's "Microphone"/"Soundcloud" input)
 *   iChannel1  this shader's previous frame (feedback; stands in for a Buffer A loop)
 *   iChannel2  256x256 RGBA noise
 *   iChannel3  256x256 RGBA noise
 *   iMouse     no pointer: xy follow the music (x = bar phase * width, y = bass * height),
 *              z = w = 0 always, i.e. "button never pressed". Shaders that switch to an
 *              automatic camera when iMouse.z <= 0 therefore take their auto path.
 *   HW_PERFORMANCE  defined as 0 (Shadertoy's "low-end GPU" path), so `#if HW_PERFORMANCE==0`
 *              picks the cheaper AA setting and the macro is never undefined.
 * All iChannels are plain sampler2D, so texture(), textureLod(), texelFetch() and
 * textureSize() work as in WebGL2 Shadertoy (texture2D() too, via three's #define).
 * `#define`s, `const`s and helper functions ("Common" tab code) may precede mainImage.
 * The Jev uniforms (uBass, uBeatPulse, uIntensity, uColA… see common.glsl) are
 * declared too, so a shader pasted from Shadertoy works as-is and can then be
 * tied to the palette / beat by editing a line or two.
 * Multi-buffer shaders (Buffer A–D, Cube A) are not supported.
 */
const HEADER = /* glsl */ `
#define HW_PERFORMANCE 0
uniform vec3 iResolution;
uniform float iTime, iTimeDelta, iFrameRate, iSampleRate;
uniform int iFrame;
uniform vec4 iMouse, iDate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iChannel0, iChannel1, iChannel2, iChannel3;
uniform float uTime, uEnergy, uSub, uBass, uMid, uHigh, uBeatPhase, uBeatPulse, uBarPhase, uBeat, uOnset, uIntensity, uBar, uBpm;
uniform vec2 uRes;
uniform vec3 uColA, uColB, uColC, uColBg;
uniform sampler2D uFFT, uWave;
`;

const FOOTER = /* glsl */ `
void main() {
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(c, gl_FragCoord.xy);
  gl_FragColor = vec4(c.rgb, 1.0);
}
`;

export interface ShadertoyOptions {
  id: string;
  source: string;
  meta: PluginMeta;
  fallbackName: string;
}

export function makeShadertoyScene(src: string, opts: ShadertoyOptions): Scene {
  const uniforms: Record<string, THREE.IUniform> = {
    ...makeAudioUniforms(),
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    iTime: { value: 0 },
    iTimeDelta: { value: 0 },
    iFrameRate: { value: 60 },
    iSampleRate: { value: 44100 },
    iFrame: { value: 0 },
    iMouse: { value: new THREE.Vector4() },
    iDate: { value: new THREE.Vector4() },
    iChannelResolution: { value: [new THREE.Vector3(512, 2, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(256, 256, 1), new THREE.Vector3(256, 256, 1)] },
    iChannelTime: { value: [0, 0, 0, 0] },
    iChannel0: { value: null },
    iChannel1: { value: null },
    iChannel2: { value: null },
    iChannel3: { value: null },
  };
  const audioU = uniforms as ReturnType<typeof makeAudioUniforms>;
  const bc: BeatCounter = { count: 0, wasHigh: false };
  let scene: THREE.Scene | null = null;
  let rts: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] | null = null;
  let read = 0;
  let frame = 0;
  let lastT = -1;
  // only pay for the feedback buffer when the shader samples iChannel1
  const usesFeedback = /\biChannel1\b/.test(src);

  const ensure = (): void => {
    if (scene) return;
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: `${HEADER}\n${sourceStart(opts.source)}\n${stripDirectives(src)}\n${SOURCE_END}\n${FOOTER}`,
      depthTest: false,
      depthWrite: false,
    });
    scene = fullscreenScene(mat).scene;
    uniforms.iChannel2!.value = noiseTexture();
    uniforms.iChannel3!.value = noiseTexture();
  };

  const m = opts.meta;
  const sc: Scene = {
    id: m.id ?? opts.id,
    name: `${m.name ?? opts.fallbackName} (Shadertoy)`,
    description: m.description ?? `Shadertoy 形式のシェーダー ${m.name ?? opts.fallbackName}`,
    short: m.short,
    maxBars: m.maxBars,
    group: m.group ?? 'shadertoy',
    source: opts.source,
    prepare() {
      ensure();
      const err = GlContext.get().tryCompile(scene!, fullscreenCamera());
      sc.error = err ?? undefined;
      return err;
    },
    reset() {
      frame = 0;
      lastT = -1;
    },
    render(ctx, input) {
      ensure();
      const gl = GlContext.get();
      gl.ensureSize(input.w, input.h);
      updateAudioUniforms(audioU, input, gl.w, gl.h, bc);
      const u = uniforms;
      (u.iResolution!.value as THREE.Vector3).set(gl.w, gl.h, 1);
      u.iTimeDelta!.value = lastT < 0 ? 1 / 60 : Math.max(0, input.t - lastT);
      u.iFrameRate!.value = 1 / Math.max(1e-3, u.iTimeDelta!.value as number);
      lastT = input.t;
      u.iTime!.value = input.t;
      u.iFrame!.value = frame++;
      (u.iChannelTime!.value as number[])[0] = input.t;
      const d = new Date();
      (u.iDate!.value as THREE.Vector4).set(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000);
      // "mouse" follows the beat so mouse-driven shaders still move: x = bar phase, y = bass;
      // z/w stay 0 (never clicked) — see the header comment
      (u.iMouse!.value as THREE.Vector4).set(input.barPhase * gl.w, input.bass * gl.h, 0, 0);
      u.iChannel0!.value = AudioTextures.shadertoy;
      const r = gl.renderer;
      if (usesFeedback) {
        rts ??= [makeTarget(gl.w, gl.h), makeTarget(gl.w, gl.h)];
        for (const rt of rts) if (rt.width !== gl.w || rt.height !== gl.h) rt.setSize(gl.w, gl.h);
        const write = rts[read === 0 ? 1 : 0];
        u.iChannel1!.value = rts[read]!.texture;
        (u.iChannelResolution!.value as THREE.Vector3[])[1]!.set(gl.w, gl.h, 1);
        r.setRenderTarget(write);
        r.render(scene!, fullscreenCamera());
        r.setRenderTarget(null);
        copyTexture(r, write.texture);
        read = read === 0 ? 1 : 0;
      } else {
        r.render(scene!, fullscreenCamera());
      }
      gl.blit(ctx, input.w, input.h);
    },
  };
  return sc;
}
