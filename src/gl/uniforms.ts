import * as THREE from 'three';
import type { RenderInput } from '../types';

/** Uniforms shared by every GL scene; updated from RenderInput each frame. */
export interface AudioUniforms extends Record<string, THREE.IUniform> {
  uTime: { value: number };
  uRes: { value: THREE.Vector2 };
  uEnergy: { value: number };
  uSub: { value: number };
  uBass: { value: number };
  uMid: { value: number };
  uHigh: { value: number };
  uBeatPhase: { value: number };
  uBeatPulse: { value: number };
  uBarPhase: { value: number };
  uBeat: { value: number };
  uOnset: { value: number };
  uIntensity: { value: number };
  uColA: { value: THREE.Color };
  uColB: { value: THREE.Color };
  uColC: { value: THREE.Color };
  uColBg: { value: THREE.Color };
}

export function makeAudioUniforms(): AudioUniforms {
  return {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uEnergy: { value: 0 },
    uSub: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uBeatPhase: { value: 0 },
    uBeatPulse: { value: 0 },
    uBarPhase: { value: 0 },
    uBeat: { value: 0 },
    uOnset: { value: 0 },
    uIntensity: { value: 0 },
    uColA: { value: new THREE.Color('#ffffff') },
    uColB: { value: new THREE.Color('#888888') },
    uColC: { value: new THREE.Color('#444444') },
    uColBg: { value: new THREE.Color('#000000') },
  };
}

/** Per-scene state that turns the decaying beat pulse into a beat counter. */
export interface BeatCounter {
  count: number;
  wasHigh: boolean;
}

export function updateAudioUniforms(u: AudioUniforms, input: RenderInput, w: number, h: number, bc: BeatCounter): void {
  u.uTime.value = input.t;
  u.uRes.value.set(w, h);
  u.uEnergy.value = input.energy;
  u.uSub.value = input.sub;
  u.uBass.value = input.bass;
  u.uMid.value = input.mid;
  u.uHigh.value = input.high;
  u.uBeatPhase.value = input.beatPhase;
  u.uBeatPulse.value = input.beatPulse;
  u.uBarPhase.value = input.barPhase;
  u.uIntensity.value = input.intensity;
  u.uOnset.value = input.onset ? 1 : 0;
  if (input.beatPulse > 0.9 && !bc.wasHigh) bc.count++;
  bc.wasHigh = input.beatPulse > 0.9;
  u.uBeat.value = bc.count;
  u.uColA.value.set(input.palette.a);
  u.uColB.value.set(input.palette.b);
  u.uColC.value.set(input.palette.c);
  u.uColBg.value.set(input.palette.bg);
}
