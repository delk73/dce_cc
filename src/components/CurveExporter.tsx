import React, { useState } from 'react';
import { ColorCurve } from '../types';
import { Check, Copy, Download } from 'lucide-react';
import { cn } from '../lib/utils';

interface CurveExporterProps {
    curve: ColorCurve;
}

type ExportFormat = 'unreal' | 'generic' | 'unity';

export const CurveExporter: React.FC<CurveExporterProps> = ({ curve }) => {
    const [copied, setCopied] = useState(false);
    const [format, setFormat] = useState<ExportFormat>('unreal');
    
    const exportUECurve = (c: ColorCurve) => {
        const mapKeys = (keys: {time: number, value: number}[]) => {
            return keys.sort((a, b) => a.time - b.time).map(k => ({
                "interpMode": "RCIM_Linear",
                "tangentMode": "RCTM_Auto",
                "tangentWeightMode": "RCTWM_WeightedNone",
                "time": k.time,
                "value": k.value,
                "arriveTangent": 0,
                "arriveTangentWeight": 0,
                "leaveTangent": 0,
                "leaveTangentWeight": 0
            }));
        };
        
        return JSON.stringify({
            "floatCurves": [
                {
                    "keys": mapKeys(c.r),
                    "defaultValue": 3.4028234663852886e+38,
                    "preInfinityExtrap": "RCCE_Constant",
                    "postInfinityExtrap": "RCCE_Constant"
                },
                {
                    "keys": mapKeys(c.g),
                    "defaultValue": 3.4028234663852886e+38,
                    "preInfinityExtrap": "RCCE_Constant",
                    "postInfinityExtrap": "RCCE_Constant"
                },
                {
                    "keys": mapKeys(c.b),
                    "defaultValue": 3.4028234663852886e+38,
                    "preInfinityExtrap": "RCCE_Constant",
                    "postInfinityExtrap": "RCCE_Constant"
                },
                {
                    "keys": mapKeys(c.a),
                    "defaultValue": 3.4028234663852886e+38,
                    "preInfinityExtrap": "RCCE_Constant",
                    "postInfinityExtrap": "RCCE_Constant"
                }
            ],
            "adjustHue": 0,
            "adjustSaturation": 1,
            "adjustBrightness": 1,
            "adjustBrightnessCurve": 1,
            "adjustVibrance": 0,
            "adjustMinAlpha": 0,
            "adjustMaxAlpha": 1,
            "assetImportData": {
                "_ClassName": "/Script/Engine.AssetImportData",
                "sourceData": {}
            }
        }, null, '\t');
    };

    const exportGenericCurve = (c: ColorCurve) => {
        return JSON.stringify(c, null, 2);
    };

    const exportUnityCurve = (c: ColorCurve) => {
        const mapKeys = (keys: {time: number, value: number}[]) => {
            return keys.sort((a, b) => a.time - b.time).map(k => ({
                "time": k.time,
                "value": k.value,
                "inTangent": 0,
                "outTangent": 0,
                "tangentMode": 0
            }));
        };
        return JSON.stringify({
            "curveR": mapKeys(c.r),
            "curveG": mapKeys(c.g),
            "curveB": mapKeys(c.b),
            "curveA": mapKeys(c.a)
        }, null, 2);
    };

    const getExportText = () => {
        if (format === 'unreal') return exportUECurve(curve);
        if (format === 'generic') return exportGenericCurve(curve);
        if (format === 'unity') return exportUnityCurve(curve);
        return '';
    };

    const handleCopy = async () => {
        const text = getExportText();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const text = getExportText();
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ColorCurve_${format}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-zinc-100 font-medium tracking-tight">Export Output</h3>
            </div>
            
            <div className="flex bg-[#09090b] rounded-lg p-1 border border-zinc-800">
                <button 
                  onClick={() => setFormat('unreal')}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", format === 'unreal' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                >
                  Unreal Engine
                </button>
                <button 
                  onClick={() => setFormat('unity')}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", format === 'unity' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                >
                  Unity
                </button>
                <button 
                  onClick={() => setFormat('generic')}
                  className={cn("flex-1 py-1.5 text-xs font-medium rounded-md transition-all", format === 'generic' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                >
                  Generic JSON
                </button>
            </div>

            <pre className="bg-[#09090b] text-zinc-400 text-xs p-4 rounded-lg overflow-auto max-h-64 scrollbar-thin scrollbar-thumb-zinc-700">
                {getExportText()}
            </pre>

            <div className="flex gap-2">
                <button 
                    onClick={handleCopy}
                    className="flex-1 flex justify-center items-center gap-2 px-3 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors"
                >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
                <button 
                    onClick={handleDownload}
                    className="flex-1 flex justify-center items-center gap-2 px-3 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Download
                </button>
            </div>
        </div>
    );
};
