import React, { useState, useEffect } from 'react';
import { ColorCurve, Channel, LibraryCurve } from './types';
import { CurveEditor } from './components/CurveEditor';
import { CurveExporter } from './components/CurveExporter';
import { CurvePreview } from './components/CurvePreview';
import { generateCurve, generateCurveBatch } from './services/geminiService';
import { Sparkles, Loader2, Library, Plus, Trash2, FolderOpen, Layers } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const initialCurve: ColorCurve = {
  r: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  g: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  b: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  a: [{ time: 0, value: 1 }, { time: 1, value: 1 }]
};

export default function App() {
  const [library, setLibrary] = useState<LibraryCurve[]>([]);
  const [activeCurveId, setActiveCurveId] = useState<string | null>(null);

  const [activeChannel, setActiveChannel] = useState<Channel>('r');
  
  // Prompting State
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [prompt, setPrompt] = useState('Fiery explosion transitioning to thick dark smoke');
  const [variance, setVariance] = useState('Intensity scaling from dying ember to supernova');
  const [batchCount, setBatchCount] = useState<number>(3);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('curve-library');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLibrary(parsed);
        if (parsed.length > 0) setActiveCurveId(parsed[0].id);
      } catch (e) {
        console.error("Failed to parse library", e);
      }
    } else {
      // Default initial curve
      const defaultCurve: LibraryCurve = { id: crypto.randomUUID(), name: 'Default Sweep', category: 'Basic', curve: initialCurve };
      setLibrary([defaultCurve]);
      setActiveCurveId(defaultCurve.id);
    }
  }, []);

  // Save to local storage whenever library changes
  useEffect(() => {
    if (library.length > 0) {
      localStorage.setItem('curve-library', JSON.stringify(library));
    }
  }, [library]);

  const activeCurve = library.find(c => c.id === activeCurveId)?.curve || initialCurve;

  const updateActiveCurve = (newCurve: ColorCurve) => {
    setLibrary(prev => prev.map(c => c.id === activeCurveId ? { ...c, curve: newCurve } : c));
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      if (mode === 'single') {
        const generated = await generateCurve(prompt);
        const newEntry: LibraryCurve = { 
          id: crypto.randomUUID(), 
          name: prompt.substring(0, 20) + (prompt.length > 20 ? '...' : ''), 
          category: 'Generated', 
          curve: generated 
        };
        setLibrary(prev => [newEntry, ...prev]);
        setActiveCurveId(newEntry.id);
      } else {
        const generatedBatch = await generateCurveBatch(prompt, variance, batchCount);
        const newEntries: LibraryCurve[] = generatedBatch.map(b => ({
          id: crypto.randomUUID(),
          name: b.name,
          category: b.category || 'Batch',
          curve: b.curve
        }));
        setLibrary(prev => [...newEntries, ...prev]);
        if (newEntries.length > 0) {
          setActiveCurveId(newEntries[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to generate curve:", err);
      setError(err.message || 'Failed to generate curve layout. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLibrary(prev => {
        const next = prev.filter(c => c.id !== id);
        if (activeCurveId === id && next.length > 0) {
            setActiveCurveId(next[0].id);
        } else if (next.length === 0) {
            setActiveCurveId(null);
        }
        return next;
    });
  };

  const channelInfo = [
    { id: 'r', label: 'Red', color: 'bg-red-500' },
    { id: 'g', label: 'Green', color: 'bg-green-500' },
    { id: 'b', label: 'Blue', color: 'bg-blue-500' },
    { id: 'a', label: 'Alpha', color: 'bg-stone-400' },
  ];

  // Group library by category
  const libraryByCategory = library.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
  }, {} as Record<string, LibraryCurve[]>);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-8 space-y-8">
        
        {/* Header */}
        <header className="space-y-4 pt-4 pb-8 border-b border-white/5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-medium tracking-wide border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            AI Studio Powered
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Color Curve Architect</h1>
          <p className="text-zinc-400 max-w-2xl text-lg tracking-tight leading-relaxed">
            Prompt Gemini to craft multi-channel color gradients and emission curves for Unreal Engine. Edit keyframes visually and export to JSON instantly.
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
            
          {/* Main Area (Editor + Generate) */}
          <div className="xl:col-span-3 space-y-8">
            
            {/* AI Prompting Area */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-4">
              <div className="flex gap-2 p-1 bg-black rounded-lg w-fit border border-zinc-800">
                <button 
                  onClick={() => setMode('single')}
                  className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", mode === 'single' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                >
                  Single Curve
                </button>
                <button 
                  onClick={() => setMode('batch')}
                  className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", mode === 'batch' ? 'bg-indigo-600/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300')}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Batch Variants
                  </div>
                </button>
              </div>

              <div className="space-y-3 relative">
                <input 
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    placeholder="Describe your base color transition... (e.g., 'Magic arcane spell fading to frost')"
                    className="w-full bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 text-sm py-3 px-4 shadow-inner"
                />
                
                {mode === 'batch' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex gap-3">
                     <div className="flex-1 space-y-1">
                        <label className="text-[10px] text-indigo-400/80 font-medium uppercase tracking-wider pl-1">Intentional Variance Sweep</label>
                        <input 
                            type="text"
                            value={variance}
                            onChange={(e) => setVariance(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                            placeholder="e.g. 'Intensity scaling from dying ember to supernova'"
                            className="w-full bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 text-sm py-3 px-4 shadow-inner placeholder:text-zinc-600"
                        />
                     </div>
                     <div className="w-24 space-y-1 shrink-0">
                        <label className="text-[10px] text-indigo-400/80 font-medium uppercase tracking-wider pl-1">Count</label>
                        <input 
                            type="number"
                            min="2" max="5"
                            value={batchCount}
                            onChange={(e) => setBatchCount(parseInt(e.target.value) || 3)}
                            className="w-full bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 text-sm py-3 px-4 shadow-inner text-center"
                        />
                     </div>
                  </motion.div>
                )}
                
                <div className="pt-2 flex justify-end">
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className={cn(
                        "flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all group shrink-0",
                        isGenerating || !prompt.trim() 
                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                            : "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
                        )}
                    >
                        {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                        <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        )}
                        {isGenerating ? `Generating ${mode === 'batch' ? 'Batch' : ''}...` : `Generate ${mode === 'batch' ? 'Batch' : 'Curve'}`}
                    </button>
                </div>
              </div>

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
            </section>
            
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium">Curve Editor</h2>
                <div className="flex gap-2 border border-zinc-800 p-1 rounded-full bg-[#09090b]">
                    {channelInfo.map((ci) => (
                    <button
                        key={ci.id}
                        onClick={() => setActiveChannel(ci.id as Channel)}
                        className={cn(
                        "px-4 py-1.5 rounded-full text-xs font-medium transition-all border",
                        activeChannel === ci.id 
                            ? `bg-zinc-800 border-zinc-700 text-white shadow-sm` 
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

                <CurveEditor curve={activeCurve} onChange={updateActiveCurve} activeChannel={activeChannel} />
                
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <CurvePreview curve={activeCurve} />
                <CurveExporter curve={activeCurve} />
            </div>

          </div>

          {/* Library Sidebar */}
          <div className="xl:col-span-1 border border-zinc-800 bg-zinc-900 rounded-2xl flex flex-col h-[calc(100vh-12rem)] sticky top-8">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Library className="w-4 h-4 text-zinc-400" />
                      <h3 className="font-medium text-sm">Curve Library</h3>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">{library.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800">
                  {Object.entries(libraryByCategory).map(([category, curves]) => (
                      <div key={category} className="mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 py-1.5 mb-1">{category}</h4>
                          <div className="space-y-1">
                              {curves.map(c => (
                                  <button
                                      key={c.id}
                                      onClick={() => setActiveCurveId(c.id)}
                                      className={cn(
                                          "w-full flex items-center justify-between text-left px-3 py-2 rounded-lg transition-all border text-xs group",
                                          activeCurveId === c.id 
                                              ? "bg-indigo-500/10 border-indigo-500/50 text-white" 
                                              : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                                      )}
                                  >
                                      <span className="truncate pr-2">{c.name}</span>
                                      <Trash2 
                                          onClick={(e) => handleDelete(c.id, e)}
                                          className={cn("w-3.5 h-3.5 text-zinc-500 hover:text-red-400 transition-colors shrink-0", activeCurveId === c.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")} 
                                      />
                                  </button>
                              ))}
                          </div>
                      </div>
                  ))}

                  {library.length === 0 && (
                      <div className="py-12 flex flex-col items-center justify-center text-zinc-600 space-y-3">
                          <FolderOpen className="w-8 h-8 opacity-50" />
                          <p className="text-sm">Library is empty</p>
                      </div>
                  )}
              </div>
          </div>

        </div>

      </div>
    </div>
  );
}

