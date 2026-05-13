import React, { useState, useEffect } from 'react';
import { ColorCurve, Channel, LibraryCurve } from './types';
import { CurveEditor } from './components/CurveEditor';
import { CurveExporter } from './components/CurveExporter';
import { CurvePreview } from './components/CurvePreview';
import { generateCurve, generateCurveBatch } from './services/geminiService';
import { Sparkles, Loader2, Library, Plus, Trash2, FolderOpen, Layers, Settings2, Download } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { InterpMode, computeTangents, evaluateCurve, blendSpaceCurves } from './lib/curveUtils';
import { insertTextChunk } from './lib/pngUtils';

const initialCurve: ColorCurve = {
  r: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  g: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  b: [{ time: 0, value: 0 }, { time: 1, value: 1 }],
  a: [{ time: 0, value: 1 }, { time: 1, value: 1 }]
};

import { AtlasViewer } from './components/AtlasViewer';

export default function App() {
  const [library, setLibrary] = useState<LibraryCurve[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'editor' | 'atlas'>('editor');
  
  const [editorState, setEditorState] = useState({ lever: 0, wrap: false, blend: 0.1 });
  const [atlasState, setAtlasState] = useState({ lever: 0, wrap: false, blend: 0.1 });
  
  const [exportWidth, setExportWidth] = useState<number>(256);
  const [exportHeight, setExportHeight] = useState<number>(256);

  const spaceLever = mainView === 'editor' ? editorState.lever : atlasState.lever;
  const wrapSpace = mainView === 'editor' ? editorState.wrap : atlasState.wrap;
  const loopBlend = mainView === 'editor' ? editorState.blend : atlasState.blend;

  const setSpaceLever = (val: number) => {
      if (mainView === 'editor') setEditorState(prev => ({...prev, lever: val}));
      else setAtlasState(prev => ({...prev, lever: val}));
  };
  const setWrapSpace = (val: boolean) => {
      if (mainView === 'editor') setEditorState(prev => ({...prev, wrap: val}));
      else setAtlasState(prev => ({...prev, wrap: val}));
  };
  const setLoopBlend = (val: number) => {
      if (mainView === 'editor') setEditorState(prev => ({...prev, blend: val}));
      else setAtlasState(prev => ({...prev, blend: val}));
  };

  const [activeChannel, setActiveChannel] = useState<Channel>('r');
  const [interpMode, setInterpMode] = useState<InterpMode>('cubic');
  
  // Prompting State
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [prompt, setPrompt] = useState('Fiery explosion transitioning to thick dark smoke');
  const [variance, setVariance] = useState('Intensity scaling from dying ember to supernova');
  const [batchCount, setBatchCount] = useState<number>(4);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('curve-library');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLibrary(parsed);
        if (parsed.length > 0) setActiveCategoryId(parsed[0].category);
      } catch (e) {
        console.error("Failed to parse library", e);
      }
    } else {
      // Default initial curve
      const defaultCurve: LibraryCurve = { id: crypto.randomUUID(), name: 'Default Sweep', category: 'Basic', position: 0, curve: initialCurve };
      setLibrary([defaultCurve]);
      setActiveCategoryId(defaultCurve.category);
    }
  }, []);

  // Save to local storage whenever library changes
  useEffect(() => {
    if (library.length > 0) {
      localStorage.setItem('curve-library', JSON.stringify(library));
    }
  }, [library]);

  const activeCategoryCurves = (library.filter(c => c.category === activeCategoryId) || []).sort((a,b) => (a.position||0) - (b.position||0));
  
  // Ensure default position parameters exist (for backwards compat)
  const normalizedCategoryCurves = activeCategoryCurves.map((c, i) => ({
      ...c,
      position: c.position ?? (activeCategoryCurves.length > 1 ? i / (activeCategoryCurves.length - 1) : 0)
  }));

  const spaceCurves = wrapSpace && normalizedCategoryCurves.length > 0 
    ? [
        ...normalizedCategoryCurves.map((c) => ({
          ...c, 
          position: c.position * (1 - loopBlend)
        })),
        { ...normalizedCategoryCurves[0], position: 1.0, id: 'wrap-dummy' }
      ]
    : normalizedCategoryCurves;

  const activeSpaceCurve = spaceCurves.length > 0 
    ? blendSpaceCurves(spaceCurves, spaceLever, interpMode)
    : initialCurve;

  const updateActiveCurve = (newCurve: ColorCurve) => {
    if (!activeCategoryId) return;
    const exactMatch = spaceCurves.find(c => Math.abs(c.position - spaceLever) < 0.01);
    
    if (exactMatch) {
       const targetId = exactMatch.id === 'wrap-dummy' ? normalizedCategoryCurves[0].id : exactMatch.id;
       setLibrary(prev => prev.map(c => c.id === targetId ? { ...c, curve: newCurve } : c));
    } else {
       const newEntry: LibraryCurve = {
           id: crypto.randomUUID(),
           name: `Variant ${Math.round(spaceLever * 100)}%`,
           category: activeCategoryId,
           position: spaceLever,
           curve: newCurve
       };
       setLibrary(prev => [...prev, newEntry]);
    }
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
          category: prompt.substring(0, 15) + '...', 
          position: 0,
          curve: generated 
        };
        setLibrary(prev => [newEntry, ...prev]);
        setActiveCategoryId(newEntry.category);
        setEditorState(prev => ({...prev, lever: 0}));
        setAtlasState(prev => ({...prev, lever: 0}));
      } else {
        const generatedBatch = await generateCurveBatch(prompt, variance, batchCount, activeSpaceCurve);
        
        let newCategory = prompt.substring(0, 15) + ' (Batch)';
        
        const newEntries: LibraryCurve[] = generatedBatch.map((b, i) => ({
          id: crypto.randomUUID(),
          name: b.name,
          category: newCategory,
          position: i / (batchCount - 1),
          curve: b.curve
        }));
        setLibrary(prev => [...newEntries, ...prev]);
        setActiveCategoryId(newCategory);
        setEditorState(prev => ({...prev, lever: 0}));
        setAtlasState(prev => ({...prev, lever: 0}));
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
        // If we deleted the last of this category, we might need to swap categories, handled safely by rendering
        return next;
    });
  };

  const handleDeleteCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLibrary(prev => {
        const next = prev.filter(c => c.category !== category);
        if (activeCategoryId === category && next.length > 0) {
            setActiveCategoryId(next[0].category);
            setEditorState(prev => ({...prev, lever: 0}));
            setAtlasState(prev => ({...prev, lever: 0}));
        } else if (next.length === 0) {
            setActiveCategoryId(null);
        }
        return next;
    });
  };

  const handleExportLibraryLUT = () => {
    if (!activeCategoryId || normalizedCategoryCurves.length === 0) return;
    
    const width = exportWidth;
    const height = exportHeight; 

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y++) {
        const tSpace = y / (height - 1);
        const curveObj = blendSpaceCurves(spaceCurves, tSpace, interpMode);
        
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
    const url = canvas.toDataURL('image/png');
    
    // Embed provenance directly into the PNG tEXt chunk
    const metadataJSON = JSON.stringify(normalizedCategoryCurves.map(c => ({
      name: c.name,
      category: c.category,
      position: c.position,
      curve: c.curve
    })));

    const finalUrl = insertTextChunk(url, 'Provenance', metadataJSON);

    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = `SpaceAtlas_${activeCategoryId.replace(/\s+/g, '')}.png`;
    a.click();
    URL.revokeObjectURL(finalUrl);
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
          <h1 className="text-4xl font-semibold tracking-tight text-white">Color Curve Composer</h1>
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
                        <select
                            value={batchCount}
                            onChange={(e) => setBatchCount(parseInt(e.target.value))}
                            className="w-full bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-indigo-500/50 text-sm py-3 px-4 shadow-inner text-center appearance-none"
                        >
                            {[2, 4, 8, 16, 32, 64].map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
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
            
            <div className="flex gap-2 p-1 bg-[#09090b] rounded-lg w-fit border border-zinc-800 mb-4">
              <button 
                onClick={() => setMainView('editor')}
                className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", mainView === 'editor' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
              >
                Curve Setup
              </button>
              {normalizedCategoryCurves.length > 1 && (
                  <button 
                    onClick={() => setMainView('atlas')}
                    className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2", mainView === 'atlas' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300')}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    2D Mapping
                  </button>
              )}
            </div>

            {mainView === 'editor' ? (
              <div className="flex flex-col gap-8">
              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-medium">Curve Editor</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Interpolation Mode:</span>
                    <select
                      value={interpMode}
                      onChange={(e) => setInterpMode(e.target.value as InterpMode)}
                      className="bg-black border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-0.5 outline-none focus:border-indigo-500/50"
                    >
                      <option value="linear">Linear</option>
                      <option value="cubic">Cubic (Hermite)</option>
                      <option value="constant">Constant (Stepped)</option>
                    </select>
                  </div>
                </div>
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

                {normalizedCategoryCurves.length > 1 && (
                  <div className="flex items-center gap-4 bg-black border border-zinc-800 rounded-xl px-4 py-3 shadow-inner">
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-400 font-medium tracking-wide uppercase">Space Variant</span>
                        <div className="flex items-center gap-3">
                           {wrapSpace && (
                               <div className="flex items-center gap-2 mr-2">
                                   <span className="text-[10px] text-zinc-500">Blend to Start</span>
                                   <input 
                                       type="range"
                                       min="0" max="0.5" step="0.01"
                                       value={loopBlend}
                                       onChange={(e) => setLoopBlend(parseFloat(e.target.value))}
                                       className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                   />
                               </div>
                           )}
                           <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                              <input 
                                 type="checkbox" 
                                 checked={wrapSpace} 
                                 onChange={(e) => setWrapSpace(e.target.checked)} 
                                 className="accent-indigo-500 w-3 h-3"
                              />
                              Seamless Loop
                           </label>
                           <span className="text-xs text-indigo-400 font-mono">{(spaceLever * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.001"
                        value={spaceLever}
                        onChange={(e) => setSpaceLever(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        style={{
                           background: `linear-gradient(to right, rgb(99 102 241) ${spaceLever * 100}%, rgb(39 39 42) ${spaceLever * 100}%)`
                        }}
                      />
                    </div>
                  </div>
                )}

                <CurveEditor curve={activeSpaceCurve} onChange={updateActiveCurve} activeChannel={activeChannel} interpMode={interpMode} />
                
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
                <CurvePreview curve={activeSpaceCurve} interpMode={interpMode} />
                <CurveExporter curve={activeSpaceCurve} interpMode={interpMode} />
            </div>
            </div>
            ) : (
                <div className="flex flex-col gap-8 h-full min-h-[500px]">
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-8 flex-1">
                        <div className="md:col-span-3 flex flex-col">
                            <AtlasViewer 
                                curves={spaceCurves} 
                                interpMode={interpMode} 
                                spaceLever={spaceLever} 
                                setSpaceLever={setSpaceLever} 
                                wrapSpace={wrapSpace}
                                setWrapSpace={setWrapSpace}
                                loopBlend={loopBlend}
                                setLoopBlend={setLoopBlend}
                            />
                        </div>
                        <div className="md:col-span-4 flex flex-col gap-8">
                            <CurvePreview curve={activeSpaceCurve} interpMode={interpMode} />
                            <CurveExporter curve={activeSpaceCurve} interpMode={interpMode} />
                        </div>
                    </div>
                </div>
            )}
            
          </div>

          {/* Library Sidebar */}
          <div className="xl:col-span-1 border border-zinc-800 bg-zinc-900 rounded-2xl flex flex-col h-[calc(100vh-12rem)] sticky top-8">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Library className="w-4 h-4 text-zinc-400" />
                      <h3 className="font-medium text-sm">Theme Spaces</h3>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">{Object.keys(libraryByCategory).length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800">
                  {Object.entries(libraryByCategory).map(([category, curves]) => (
                      <div key={category} className="mb-2">
                          <div 
                             className={cn(
                               "w-full flex items-center justify-between text-left px-3 py-2 rounded-lg transition-all border text-xs group cursor-pointer",
                               activeCategoryId === category
                                 ? "bg-zinc-800 border-zinc-700 text-white" 
                                 : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                             )}
                             onClick={() => {
                                 if (activeCategoryId !== category) {
                                     setEditorState(prev => ({...prev, lever: 0}));
                                     setAtlasState(prev => ({...prev, lever: 0}));
                                 }
                                 setActiveCategoryId(category);
                             }}
                          >
                             <span className="font-medium truncate">{category}</span>
                             <div className="flex items-center gap-2">
                                <span className="opacity-50 group-hover:opacity-100 transition-opacity">({curves.length})</span>
                                <Trash2 
                                  onClick={(e) => handleDeleteCategory(category, e)}
                                  className={cn("w-3.5 h-3.5 text-zinc-500 hover:text-red-400 transition-colors shrink-0", activeCategoryId === category ? "opacity-100" : "opacity-0 group-hover:opacity-100")} 
                                />
                             </div>
                          </div>
                          {activeCategoryId === category && curves.length > 1 && (
                            <div className="pl-4 pr-1 py-1 space-y-1 my-1 border-l border-zinc-800 ml-3">
                                {curves.sort((a,b)=>(a.position||0)-(b.position||0)).map(c => (
                                    <button
                                        key={c.id}
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setActiveCategoryId(category); 
                                            setEditorState(prev => ({...prev, lever: Math.max(0, Math.min(1, c.position || 0))}));
                                            setAtlasState(prev => ({...prev, lever: Math.max(0, Math.min(1, c.position || 0))}));
                                            setMainView('editor');
                                        }}
                                        className={cn(
                                            "w-full flex items-center justify-between text-left px-2 py-1.5 rounded-lg transition-all text-[10px] group",
                                            Math.abs(spaceLever - (c.position || 0)) < 0.01
                                                ? "bg-indigo-500/10 text-indigo-300" 
                                                : "bg-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                                        )}
                                    >
                                        <span className="truncate pr-2">{c.name}</span>
                                        <span className="opacity-50 font-mono scale-90">{(c.position||0).toFixed(2)}</span>
                                    </button>
                                ))}
                            </div>
                          )}
                      </div>
                  ))}

                  {library.length === 0 && (
                      <div className="py-12 flex flex-col items-center justify-center text-zinc-600 space-y-3">
                          <FolderOpen className="w-8 h-8 opacity-50" />
                          <p className="text-sm">Library is empty</p>
                      </div>
                  )}
              </div>

              {library.length > 0 && (
                  <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 flex flex-col items-center justify-center space-y-3 pb-5">
                      <div className="flex w-full gap-2 text-xs">
                          <div className="flex-1 flex flex-col gap-1">
                              <label className="text-zinc-500 font-medium">Width (Time)</label>
                              <select 
                                  value={exportWidth}
                                  onChange={(e) => setExportWidth(Number(e.target.value))}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-zinc-300 outline-none focus:border-indigo-500"
                              >
                                  <option value={64}>64</option>
                                  <option value={128}>128</option>
                                  <option value={256}>256</option>
                                  <option value={512}>512</option>
                                  <option value={1024}>1024</option>
                                  <option value={2048}>2048</option>
                              </select>
                          </div>
                          <div className="flex-1 flex flex-col gap-1">
                              <label className="text-zinc-500 font-medium">Height (Variants)</label>
                              <select 
                                  value={exportHeight}
                                  onChange={(e) => setExportHeight(Number(e.target.value))}
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-zinc-300 outline-none focus:border-indigo-500"
                              >
                                  <option value={64}>64</option>
                                  <option value={128}>128</option>
                                  <option value={256}>256</option>
                                  <option value={512}>512</option>
                                  <option value={1024}>1024</option>
                                  <option value={2048}>2048</option>
                              </select>
                          </div>
                      </div>

                      <button 
                          onClick={handleExportLibraryLUT}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-xl font-medium text-sm transition-colors border border-indigo-500/20 hover:border-indigo-500/40 mt-1"
                      >
                          <Download className="w-4 h-4" />
                          Export 2D LUT Atlas
                      </button>
                      <p className="text-[10px] text-zinc-500 text-center leading-tight">
                          {exportWidth}x{exportHeight} texture &bull; Full Variant Space Interpolation<br/>
                          Provenance metadata encoded in PNG
                      </p>
                  </div>
              )}
          </div>

        </div>

      </div>
    </div>
  );
}

