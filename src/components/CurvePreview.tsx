import React, { useEffect, useRef, useState } from 'react';
import { ColorCurve } from '../types';

interface CurvePreviewProps {
  curve: ColorCurve;
}

function interpolateChannel(keyframes: { time: number; value: number }[], t: number): number {
  if (keyframes.length === 0) return 0;
  if (keyframes.length === 1) return keyframes[0].value;
  
  if (t <= keyframes[0].time) return keyframes[0].value;
  if (t >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;
  
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];
    if (t >= k1.time && t <= k2.time) {
      if (k2.time === k1.time) return k1.value;
      const tNorm = (t - k1.time) / (k2.time - k1.time);
      return k1.value + (k2.value - k1.value) * tNorm;
    }
  }
  return 0;
}

export const CurvePreview: React.FC<CurvePreviewProps> = ({ curve }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState(0.0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.min(cx, cy);

    // Sort keyframes for safe interpolation
    const sortedCurve = {
      r: [...curve.r].sort((a, b) => a.time - b.time),
      g: [...curve.g].sort((a, b) => a.time - b.time),
      b: [...curve.b].sort((a, b) => a.time - b.time),
      a: [...curve.a].sort((a, b) => a.time - b.time),
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Distance from center, normalized to 0..1
        const dx = (x - cx) / maxDist;
        const dy = (y - cy) / maxDist;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        // Input time based on distance, scale, and offset
        const t = d * scale + offset;
        
        // Evaluate curve at time `t`
        const r = interpolateChannel(sortedCurve.r, t);
        const g = interpolateChannel(sortedCurve.g, t);
        const b = interpolateChannel(sortedCurve.b, t);
        const a = interpolateChannel(sortedCurve.a, t);

        // Clamp values to 0-255 range for Canvas API
        const r8 = Math.min(255, Math.max(0, r * 255));
        const g8 = Math.min(255, Math.max(0, g * 255));
        const b8 = Math.min(255, Math.max(0, b * 255));
        const a8 = Math.min(255, Math.max(0, a * 255));

        const index = (y * width + x) * 4;
        data[index] = r8;
        data[index + 1] = g8;
        data[index + 2] = b8;
        data[index + 3] = a8;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [curve, scale, offset]);

  return (
    <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-100 font-medium tracking-tight">SDF Preview</h3>
      </div>
      
      <div 
        className="relative w-full aspect-square rounded-lg overflow-hidden border border-zinc-800"
        style={{
          backgroundColor: '#09090b',
          backgroundImage: `
            linear-gradient(45deg, #18181b 25%, transparent 25%), 
            linear-gradient(-45deg, #18181b 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #18181b 75%), 
            linear-gradient(-45deg, transparent 75%, #18181b 75%)`,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }}
      >
        <canvas 
          ref={canvasRef} 
          width={256} 
          height={256} 
          className="w-full h-full object-contain"
        />
      </div>

      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <label>Scale</label>
            <span>{scale.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.05" 
            value={scale} 
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 bg-zinc-800 appearance-none h-1.5 rounded-full outline-none"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <label>Offset</label>
            <span>{offset.toFixed(2)}</span>
          </div>
          <input 
            type="range" 
            min="-1" 
            max="1" 
            step="0.05" 
            value={offset} 
            onChange={(e) => setOffset(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 bg-zinc-800 appearance-none h-1.5 rounded-full outline-none"
          />
        </div>
      </div>
    </div>
  );
};
