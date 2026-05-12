import { Keyframe } from '../types';

export type InterpMode = 'linear' | 'cubic';

export function computeTangents(data: Keyframe[]): number[] {
  const n = data.length;
  const tangents = new Array(n).fill(0);
  if (n < 2) return tangents;
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tangents[i] = (data[1].value - data[0].value) / Math.max(0.0001, data[1].time - data[0].time);
    } else if (i === n - 1) {
      tangents[i] = (data[i].value - data[i-1].value) / Math.max(0.0001, data[i].time - data[i-1].time);
    } else {
      // Catmull-Rom / average secant (Auto tangency)
      tangents[i] = (data[i+1].value - data[i-1].value) / Math.max(0.0001, data[i+1].time - data[i-1].time);
    }
  }
  return tangents;
}

export function evaluateCurve(keyframes: Keyframe[], tangents: number[], t: number, interpMode: InterpMode): number {
  const n = keyframes.length;
  if (n === 0) return 0;
  if (n === 1) return keyframes[0].value;
  
  if (t <= keyframes[0].time) return keyframes[0].value;
  if (t >= keyframes[n - 1].time) return keyframes[n - 1].value;
  
  for (let i = 0; i < n - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];
    if (t >= k1.time && t <= k2.time) {
      const dx = k2.time - k1.time;
      if (dx <= 0) return k1.value;
      
      const tNorm = (t - k1.time) / dx;
      
      if (interpMode === 'linear') {
        return k1.value + (k2.value - k1.value) * tNorm;
      } else {
        const t2 = tNorm * tNorm;
        const t3 = t2 * tNorm;
        
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + tNorm;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        
        const m0 = tangents[i];
        const m1 = tangents[i + 1];
        
        return h00 * k1.value + h10 * dx * m0 + h01 * k2.value + h11 * dx * m1;
      }
    }
  }
  return 0;
}
