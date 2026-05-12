import React, { useEffect, useRef } from 'react';
import { LibraryCurve } from '../types';
import { InterpMode, computeTangents, evaluateCurve, blendSpaceCurves } from '../lib/curveUtils';

interface AtlasViewerProps {
  curves: LibraryCurve[];
  interpMode: InterpMode;
  spaceLever: number;
  setSpaceLever: (val: number) => void;
}

export const AtlasViewer: React.FC<AtlasViewerProps> = ({ curves, interpMode, spaceLever, setSpaceLever }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || curves.length === 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const width = 256;
    const height = 256;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        const tSpace = 1.0 - (y / (height - 1));
        const curveObj = blendSpaceCurves(curves, tSpace, interpMode);
        
        const sortedCurve = {
            r: [...curveObj.r].sort((a, b) => a.time - b.time),
            g: [...curveObj.g].sort((a, b) => a.time - b.time),
            b: [...curveObj.b].sort((a, b) => a.time - b.time),
            a: [...curveObj.a].sort((a, b) => a.time - b.time),
        };
        const tangents = {
            r: computeTangents(sortedCurve.r),
            g: computeTangents(sortedCurve.g),
            b: computeTangents(sortedCurve.b),
            a: computeTangents(sortedCurve.a)
        };

        for (let x = 0; x < width; x++) {
            const t = x / (width - 1);
            const r = evaluateCurve(sortedCurve.r, tangents.r, t, interpMode);
            const g = evaluateCurve(sortedCurve.g, tangents.g, t, interpMode);
            const b = evaluateCurve(sortedCurve.b, tangents.b, t, interpMode);
            const a = evaluateCurve(sortedCurve.a, tangents.a, t, interpMode);
            
            const idx = (y * width + x) * 4;
            data[idx] = Math.min(255, Math.max(0, r * 255));
            data[idx + 1] = Math.min(255, Math.max(0, g * 255));
            data[idx + 2] = Math.min(255, Math.max(0, b * 255));
            data[idx + 3] = Math.min(255, Math.max(0, a * 255));
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
  }, [curves, interpMode]);

  const handlePointer = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      const y = clientY - rect.top;
      const t = Math.max(0, Math.min(1, 1.0 - (y / rect.height)));
      setSpaceLever(t);
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-zinc-100 font-medium tracking-tight">2D Interpolation Atlas</h3>
      </div>
      
      <div className="flex gap-6 items-stretch">
          <div className="flex flex-col justify-between py-2 text-[10px] text-zinc-500 font-mono tracking-wider">
              <span>1.0</span>
              <span className="rotate-[-90deg] whitespace-nowrap">SPACE LEVER</span>
              <span>0.0</span>
          </div>

          <div 
            className="flex-1 relative aspect-square rounded-lg overflow-hidden border border-zinc-800 shadow-inner group cursor-crosshair touch-none"
            onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                handlePointer(e);
            }}
            onPointerMove={(e) => {
                if (e.buttons > 0) handlePointer(e);
            }}
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
              className="w-full h-full object-fill style-crisp-edges"
              style={{ imageRendering: 'pixelated' }}
            />
            
            {/* Lever Line */}
            <div 
               className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] pointer-events-none"
               style={{ top: `${(1.0 - spaceLever) * 100}%`, transform: 'translateY(-50%)' }}
            >
                <div className="absolute -left-1 -top-1 w-2.5 h-2.5 bg-white rounded-full shadow" />
                <div className="absolute -right-1 -top-1 w-2.5 h-2.5 bg-white rounded-full shadow" />
            </div>
          </div>
      </div>
    </div>
  );
};
