import React, { useState } from 'react';
import { ColorCurve, Channel } from './types';
import { CurveEditor } from './components/CurveEditor';
import { CurveExporter } from './components/CurveExporter';
import { CurvePreview } from './components/CurvePreview';
import { generateCurve } from './services/geminiService';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const initialCurve: ColorCurve = {
  r: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  g: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  b: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  a: [{ time: 0, value: 1 }, { time: 1, value: 1 }]
};

export default function App() {
  const [curve, setCurve] = useState<ColorCurve>(initialCurve);
  const [activeChannel, setActiveChannel] = useState<Channel>('r');
  const [prompt, setPrompt] = useState('Fiery explosion transitioning to thick dark smoke');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateCurve(prompt);
      setCurve(generated);
    } catch (err: any) {
      console.error("Failed to generate curve:", err);
      setError(err.message || 'Failed to generate curve layout. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const channelInfo = [
    { id: 'r', label: 'Red', color: 'bg-red-500' },
    { id: 'g', label: 'Green', color: 'bg-green-500' },
    { id: 'b', label: 'Blue', color: 'bg-blue-500' },
    { id: 'a', label: 'Alpha', color: 'bg-stone-400' },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
        
        {/* Header */}
        <header className="space-y-4 pt-12 pb-8 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium tracking-wide border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            AI Studio Powered
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Color Curve Architect</h1>
          <p className="text-zinc-400 max-w-2xl text-lg tracking-tight leading-relaxed">
            Prompt Gemini to craft multi-channel color gradients and emission curves for Unreal Engine. Edit keyframes visually and export to JSON instantly.
          </p>
        </header>

        {/* AI Prompting Area */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2 pl-6 pr-2 flex items-center gap-4 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-xl">
          <input 
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="Describe your color transition... (e.g., 'Magic arcane spell fading to frost')"
            className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder:text-zinc-600 text-base py-4"
          />
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={cn(
              "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all group shrink-0",
              isGenerating || !prompt.trim() 
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                : "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
            )}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Curve'}
          </button>
        </section>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-4">
            
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium">Curve Editor</h2>
              <div className="flex gap-2">
                {channelInfo.map((ci) => (
                  <button
                    key={ci.id}
                    onClick={() => setActiveChannel(ci.id as Channel)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-medium transition-all border",
                      activeChannel === ci.id 
                        ? `bg-zinc-800 border-zinc-700 text-white` 
                        : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", ci.color)} />
                      {ci.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <CurveEditor curve={curve} onChange={setCurve} activeChannel={activeChannel} />
            
            <div className="flex gap-8 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Time Axis (X)</p>
                <p className="text-sm font-mono">0.0 to 1.0</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Value Axis (Y)</p>
                <p className="text-sm font-mono">0.0 to 2.0 (HDR supported)</p>
              </div>
            </div>
            
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
             <CurvePreview curve={curve} />
             <CurveExporter curve={curve} />
          </div>

        </div>

      </div>
    </div>
  );
}

