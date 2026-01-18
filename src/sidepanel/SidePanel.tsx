/// <reference types="chrome" />
import React, { useState } from 'react';
import { PenLine, Sparkles, AlertCircle, Copy, Check } from 'lucide-react';
import { validateInput } from '../utils/security';
import { getAIConfig, tuneText } from '../services/ai';
import { useTranslation } from '../utils/i18n';
import clsx from 'clsx';
// If clsx isn't installed, I'll just use template literals for now to be safe, 
// checking package.json... clsx IS in package.json.

export default function SidePanel() {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState<'casual' | 'polite' | 'formal' | 'kyoto' | 'decode'>('polite');
    const [output, setOutput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Storage Listener for Pending Actions (Handoff from Background)
    React.useEffect(() => {
        const processAction = (action: any) => {
            if (!action) return;

            if (action.type === 'DECODE_SELECTION') {
                setInput(action.text);
                setMode('decode');
                setShouldAutoTune(true);
            } else if (action.type === 'TUNE_SELECTION') {
                setInput(action.text);
                // Load last used tune mode or default to polite
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

        // 1. Check storage on mount (if panel was just opened)
        if (chrome.storage) {
            chrome.storage.local.get(['pendingAction']).then((result) => {
                if (result.pendingAction) {
                    processAction(result.pendingAction);
                    // Clear it so we don't re-process on reload unless needed
                    chrome.storage.local.remove('pendingAction');
                }
            });

            // 2. Listen for changes (if panel was ALREADY open)
            const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
                if (changes.pendingAction && changes.pendingAction.newValue) {
                    processAction(changes.pendingAction.newValue);
                    // Just consuming is enough. 
                    chrome.storage.local.remove('pendingAction');
                }
            };
            chrome.storage.onChanged.addListener(storageListener);
            return () => chrome.storage.onChanged.removeListener(storageListener);
        }
    }, []);

    // Auto-Tune Effect
    const [shouldAutoTune, setShouldAutoTune] = useState(false);

    React.useEffect(() => {
        if (shouldAutoTune && input) {
            handleTune();
            setShouldAutoTune(false);
        }
    }, [shouldAutoTune, input, mode]); // Depend on input/mode to ensure state is ready

    // Persist Tune Mode
    const handleModeChange = (newMode: 'casual' | 'polite' | 'formal' | 'kyoto' | 'decode') => {
        setMode(newMode);
        if (newMode !== 'decode') {
            if (chrome.storage) {
                chrome.storage.local.set({ lastTuneMode: newMode });
            }
            lastTuneModeRef.current = newMode;
        }
    };

    // Keep track of last tune mode for Tab Switching
    const lastTuneModeRef = React.useRef<'casual' | 'polite' | 'formal' | 'kyoto'>('polite');

    // Initialize lastTuneMode on load
    React.useEffect(() => {
        if (chrome.storage) {
            chrome.storage.local.get(['lastTuneMode']).then((result: { lastTuneMode?: 'casual' | 'polite' | 'formal' | 'kyoto' }) => {
                if (result.lastTuneMode) {
                    lastTuneModeRef.current = result.lastTuneMode;
                    // If we start in default 'polite', maybe switch to last used? 
                    // User didn't ask for app-open persistence, only context menu persistence, 
                    // but it's good UX. Let's stick to simple for now.
                    if (mode === 'polite') setMode(result.lastTuneMode);
                }
            });
        }
    }, []);

    // Character Count
    const charCount = input.length;
    const maxChars = 200;

    const handleTune = async () => {
        setError(null);
        setOutput('');

        try {
            // 1. Security Check
            validateInput(input);

            // 2. Config Check
            const config = await getAIConfig();
            if (!config) {
                setError("Please set your API Key in the extension settings (Popup).");
                return;
            }

            setIsLoading(true);

            // 3. Real API Call
            const result = await tuneText(input, mode, config);
            setOutput(result);

        } catch (err: any) {
            console.error("Sidepanel tune failed:", err);
            if (err.message.includes("API Key")) {
                setError("Invalid API Key. Please check your settings.");
            } else if (err.message.includes("Failed to fetch")) {
                setError("Network error. Could not connect to the AI service.");
            }
            else {
                setError("An unexpected error occurred. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (!output) return;
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const { t } = useTranslation();

    return (
        <div className="w-full min-h-screen bg-slate-50 text-slate-900 p-4 font-sans flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-600 rounded-lg text-white">
                    <PenLine size={20} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800">Tatemae Tuner</h1>
            </div>

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

            {/* Output Section (Only distinct when there is output) */}
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
    );
}
