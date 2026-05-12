import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ColorCurve } from '../types';
import { cn } from '../lib/utils';
import { evaluateCurve, computeTangents, InterpMode } from '../lib/curveUtils';

interface CurvePreviewProps {
  curve: ColorCurve;
  interpMode: InterpMode;
}

export const CurvePreview: React.FC<CurvePreviewProps> = ({ curve, interpMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.0);
  const [offset, setOffset] = useState(0.0);
  
  const [enableSplits, setEnableSplits] = useState(false);
  const [splitText, setSplitText] = useState('60, 30, 10');

  const regions = useMemo(() => {
    const parsedSplits = splitText
        .split(/[,/ ]+/)
        .map(s => parseFloat(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
        
    if (parsedSplits.length === 0) return [];
    
    const totalSplit = parsedSplits.reduce((a, b) => a + b, 0);
    const splitWeights = parsedSplits.map(s => s / totalSplit);

    let currentArea = 0;
    return splitWeights.map((w, i) => {
        const areaStart = currentArea;
        const areaEnd = currentArea + w;
        currentArea = areaEnd;
        const N = splitWeights.length;
        
        // Map to uniform segments of the curve time (0..1)
        const curveStart = i / N;
        const curveEnd = (i + 1) / N;
        
        const rScale = w > 0 ? (curveEnd - curveStart) / w : 0;
        const rOffset = curveStart - rScale * areaStart;
        
        return {
            index: i + 1,
            percentage: w * 100,
            areaStart,
            areaEnd,
            curveStart,
            curveEnd,
            scale: rScale,
            offset: rOffset
        };
    });
  }, [splitText]);

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
    
    // Compute tangents once per render pass
    const tangents = {
      r: computeTangents(sortedCurve.r),
      g: computeTangents(sortedCurve.g),
      b: computeTangents(sortedCurve.b),
      a: computeTangents(sortedCurve.a)
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Distance from center, normalized to 0..1
        const dx = (x - cx) / maxDist;
        const dy = (y - cy) / maxDist;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        // 1. Base Radial Scale & Offset
        const dAdj = d * scale + offset;
        
        let t = dAdj;

        // 2. Elegant Math Splits via Area substitution Matrix
        if (enableSplits && regions.length > 0) {
            if (dAdj <= 0) {
                t = 0;
            } else if (dAdj >= 1) {
                t = 1;
            } else {
                const A = dAdj * dAdj; // Domain warp to Area space
                
                let matchedRegion = regions[regions.length - 1]; // fallback last
                for(let i=0; i<regions.length; i++) {
                    if (A <= regions[i].areaEnd) {
                        matchedRegion = regions[i];
                        break;
                    }
                }
                
                // Matrix application
                t = A * matchedRegion.scale + matchedRegion.offset;
            }
        }
        
        // Evaluate curve at time `t`
        const r = evaluateCurve(sortedCurve.r, tangents.r, t, interpMode);
        const g = evaluateCurve(sortedCurve.g, tangents.g, t, interpMode);
        const b = evaluateCurve(sortedCurve.b, tangents.b, t, interpMode);
        const a = evaluateCurve(sortedCurve.a, tangents.a, t, interpMode);

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
  }, [curve, scale, offset, enableSplits, regions, interpMode]);

  return (
    <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-100 font-medium tracking-tight">SDF Preview</h3>
      </div>
      
      <div 
        className="relative w-full aspect-square rounded-lg overflow-hidden border border-zinc-800 shadow-inner"
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
            <label>Radial Scale</label>
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
            <label>Radial Offset</label>
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

      {/* Elegant Split Math Rules */}
      <div className="space-y-3 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-300">Elegant Split (Area Remap)</h4>
              <button 
                  onClick={() => setEnableSplits(!enableSplits)}
                  className={cn("text-xs px-2 py-1 rounded transition-colors border", 
                    enableSplits 
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" 
                    : "bg-[#09090b] text-zinc-500 border-zinc-800 hover:text-zinc-300"
                  )}
              >
                  {enableSplits ? 'Active' : 'Enable'}
              </button>
          </div>
          
          <div className={cn("transition-all duration-300 overflow-hidden", enableSplits ? "opacity-100 max-h-64" : "opacity-0 max-h-0")}>
              <div className="space-y-3">
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Distributes curve phases across visual area (d²) instead of linear distance. 
                      A piecewise scale/offset matrix transforms the distance metric to solve the radii perfectly.
                  </p>
                  
                  <input 
                      type="text" 
                      value={splitText} 
                      onChange={e => setSplitText(e.target.value)}
                      placeholder="e.g. 60, 30, 10"
                      className="w-full bg-[#09090b] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono outline-none focus:border-indigo-500/50"
                  />
                  
                  {regions.length > 0 && (
                      <div className="bg-[#09090b] p-3 rounded-lg border border-zinc-800 font-mono text-[10px] text-zinc-400 space-y-1">
                          <div className="text-indigo-400/80 mb-2">// Scale/Offset Matrix: t = A * S + O</div>
                          {regions.map(r => (
                              <div key={r.index} className="flex justify-between gap-4">
                                  <span>Phase {r.index} ({r.percentage.toFixed(0)}%)</span>
                                  <span className="text-zinc-300">
                                      S: {r.scale.toFixed(3).padStart(5, ' ')} | 
                                      O: {(r.offset >= 0 ? '+' : '')}{r.offset.toFixed(3)}
                                  </span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>

    </div>
  );
};
