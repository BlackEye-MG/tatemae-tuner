/// <reference types="chrome" />
import React, { useState, useEffect } from 'react';
import { PenLine, Sparkles, AlertCircle, Copy, Check, History, Trash2 } from 'lucide-react';
import { validateInput } from '../utils/security';
import { getAIConfig, tuneText } from '../services/ai';
import { useTranslation } from '../utils/i18n';
import clsx from 'clsx';

interface HistoryItem {
    id: string;
    input: string;
    output: string;
    mode: 'casual' | 'polite' | 'formal' | 'kyoto' | 'decode';
}

export default function SidePanel() {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'casual' | 'polite' | 'formal' | 'kyoto' | 'decode'>('polite');
    const [output, setOutput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Load history from storage on mount
    useEffect(() => {
        if (chrome.storage) {
            chrome.storage.local.get(['conversationHistory']).then((result) => {
                if (Array.isArray(result.conversationHistory)) {
                    setHistory(result.conversationHistory);
                }
            });
        }
    }, []);
    
    const processAndSaveHistory = (input: string, output: string, mode: 'casual' | 'polite' | 'formal' | 'kyoto' | 'decode') => {
        setHistory(prevHistory => {
            const newItem: HistoryItem = { id: Date.now().toString(), input, output, mode };
            const newHistory = [newItem, ...prevHistory].slice(0, 20); // Keep last 20

            if (chrome.storage) {
                chrome.storage.local.set({ conversationHistory: newHistory });
            }
            return newHistory;
        });
    };
    
    const handleTune = async () => {
        setError(null);
        setOutput('');
        setIsLoading(true);
        let currentOutput = '';
    
        try {
            validateInput(input);
            const config = await getAIConfig();
            if (!config) {
                setError("Please set your API Key in the extension settings (Popup).");
                setIsLoading(false);
                return;
            }
    
            await tuneText(input, mode, config, (chunk) => {
                if (chunk.startsWith("Error:")) {
                    setError(chunk);
                } else {
                    currentOutput += chunk;
                    setOutput((prev) => prev + chunk);
                }
            });
    
            // When streaming is done, save the final result to history
            if (!error && currentOutput) {
                processAndSaveHistory(input, currentOutput, mode);
            }
    
        } catch (err: any) {
            console.error("Sidepanel tune failed:", err);
            if (!error) {
                if (err.message.includes("API Key")) {
                    setError("Invalid API Key. Please check your settings.");
                } else if (err.message.includes("Failed to fetch")) {
                    setError("Network error. Could not connect to the AI service.");
                } else {
                    setError("An unexpected error occurred. Please try again.");
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = () => {
        setHistory([]);
        if (chrome.storage) {
            chrome.storage.local.remove('conversationHistory');
        }
    };

    // Auto-Tune Effect and other listeners... (keep them as they are)
    const [shouldAutoTune, setShouldAutoTune] = useState(false);
    useEffect(() => {
        const processAction = (action: any) => {
            if (!action) return;

            if (action.type === 'DECODE_SELECTION') {
                setInput(action.text);
                setMode('decode');
                setShouldAutoTune(true);
            } else if (action.type === 'TUNE_SELECTION') {
                setInput(action.text);
                if (chrome.storage) {
                    chrome.storage.local.get(['lastTuneMode']).then((result) => {
                        const targetMode = (result.lastTuneMode as 'casual' | 'polite' | 'formal' | 'kyoto') || 'polite';
                        setMode(targetMode);
                        setShouldAutoTune(true);
                    });
                } else {
                    setMode('polite');
                    setShouldAutoTune(true);
                }
            }
        };

        if (chrome.storage) {
            chrome.storage.local.get(['pendingAction']).then((result) => {
                if (result.pendingAction) {
                    processAction(result.pendingAction);
                    chrome.storage.local.remove('pendingAction');
                }
            });
            const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
                if (changes.pendingAction && changes.pendingAction.newValue) {
                    processAction(changes.pendingAction.newValue);
                    chrome.storage.local.remove('pendingAction');
                }
            };
            chrome.storage.onChanged.addListener(storageListener);
            return () => chrome.storage.onChanged.removeListener(storageListener);
        }
    }, []);
    
    useEffect(() => {
        if (shouldAutoTune && input) {
            handleTune();
            setShouldAutoTune(false);
        }
    }, [shouldAutoTune, input, mode]);

    const handleModeChange = (newMode: 'casual' | 'polite' | 'formal' | 'kyoto' | 'decode') => {
        setMode(newMode);
        if (newMode !== 'decode') {
            if (chrome.storage) chrome.storage.local.set({ lastTuneMode: newMode });
            lastTuneModeRef.current = newMode;
        }
    };

    const lastTuneModeRef = React.useRef<'casual' | 'polite' | 'formal' | 'kyoto'>('polite');
    useEffect(() => {
        if (chrome.storage) {
            chrome.storage.local.get(['lastTuneMode']).then((result: { lastTuneMode?: 'casual' | 'polite' | 'formal' | 'kyoto' }) => {
                if (result.lastTuneMode) {
                    lastTuneModeRef.current = result.lastTuneMode;
                    if (mode === 'polite') setMode(result.lastTuneMode);
                }
            });
        }
    }, []);

    const charCount = input.length;
    const maxChars = 200;

    const copyToClipboard = () => {
        if (!output) return;
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const { t } = useTranslation();

    return (
        <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
            <div className='p-4'>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                            <PenLine size={20} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800">Tatemae Tuner</h1>
                    </div>
                    <button onClick={() => setShowHistory(!showHistory)} className="text-slate-400 hover:text-indigo-600 p-2 rounded-full">
                        <History size={18} />
                    </button>
                </div>

                {/* Main Panel */}
                <div className={clsx(showHistory && "hidden")}>
                    {/* Mode Switcher, Input, etc. */}
                     {/* Mode Switcher (Top Level) */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                <button
                    onClick={() => handleModeChange(lastTuneModeRef.current || 'polite')}
                    className={clsx(
                        "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
                        mode !== 'decode' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Sparkles size={14} />
                    {t.tune}
                </button>
                <button
                    onClick={() => handleModeChange('decode')}
                    className={clsx(
                        "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
                        mode === 'decode' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Sparkles size={14} className="rotate-180" />
                    {t.decode}
                </button>
            </div>

            {/* Input Section */}
            <div className="mb-4 relative">
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                    {mode === 'decode' ? t.tatemaeSource : t.honneDraft}
                </label>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className={clsx(
                        "w-full h-32 p-3 text-sm rounded-xl border bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-all shadow-sm",
                        error ? "border-red-300 focus:ring-red-200" : "border-slate-200",
                        mode === 'decode' && "bg-slate-50 border-indigo-200" // Visual cue for decoder mode
                    )}
                    placeholder={mode === 'decode' ? t.placeholderDecode : t.placeholderTune}
                />
                <div className={clsx(
                    "absolute bottom-3 right-3 text-xs font-medium transition-colors",
                    charCount > maxChars ? "text-red-500" : "text-slate-400"
                )}>
                    {charCount}/{maxChars}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* Mode Selection (Only for Tune Mode) */}
            {mode !== 'decode' && (
                <div className="mb-6 animate-in slide-in-from-top-1 fade-in">
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                        {t.politenessLevel}
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200 rounded-lg">
                        {(['casual', 'polite', 'formal', 'kyoto'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m)}
                                className={clsx(
                                    "py-2 text-xs font-medium rounded-md transition-all capitalize",
                                    mode === m
                                        ? "bg-white text-indigo-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                )}
                            >
                                {/* @ts-ignore dynamic key access */}
                                {t[m]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={handleTune}
                disabled={isLoading || !input}
                className={clsx(
                    "w-full py-3 text-white rounded-xl font-semibold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                    mode === 'decode' ? "bg-slate-800 hover:bg-slate-900" : "bg-indigo-600 hover:bg-indigo-700"
                )}
            >
                {isLoading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {mode === 'decode' ? t.decoding : t.tuning}
                    </>
                ) : (
                    <>
                        <Sparkles size={16} className={mode === 'decode' ? "rotate-180 text-yellow-300" : ""} />
                        {mode === 'decode' ? t.decodeMeaning : t.tuneIt}
                    </>
                )}
            </button>
                </div>

                {/* History Panel */}
                <div className={clsx(!showHistory && "hidden", "flex flex-col h-full")}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-slate-700">{t.history}</h2>
                        <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                            <Trash2 size={12} /> {t.clearHistory}
                        </button>
                    </div>
                    <div className="space-y-3 overflow-y-auto">
                        {history.length > 0 ? history.map(item => (
                            <div key={item.id} className="p-3 bg-white rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:border-indigo-300"
                                onClick={() => {
                                    setInput(item.input);
                                    setOutput(item.output);
                                    setMode(item.mode);
                                    setShowHistory(false);
                                }}>
                                <p className="text-xs text-slate-500 truncate">{item.input}</p>
                                <p className="text-sm text-slate-800 font-medium mt-1">{item.output}</p>
                            </div>
                        )) : <p className="text-sm text-slate-400 text-center py-8">{t.noHistory}</p>}
                    </div>
                </div>
            </div>

            {/* This part remains outside the main p-4 for the sticky output */}
            <div className={clsx("mt-auto p-4", showHistory && "hidden")}>
                {output && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                         <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {mode === 'decode' ? t.honneMeaning : t.tatemaeResult}
                        </label>
                        <button
                            onClick={copyToClipboard}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Copy to clipboard"
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                    </div>
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-slate-800 leading-relaxed shadow-sm relative group">
                        {output}
                    </div>
                    </div>
                )}
            </div>
        </div>
    );
}
