/// <reference types="chrome" />
import { useState, useEffect } from 'react';
import { Key, Save, Check, Globe, Trash2 } from 'lucide-react';
import { RECENT_MODELS } from '../utils/models';
import clsx from 'clsx';
import { useTranslation } from '../utils/i18n';

export default function Popup() {
    const [apiKey, setApiKey] = useState('');
    const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
    const [modelId, setModelId] = useState('');
    const [saved, setSaved] = useState(false);
    const [cacheCleared, setCacheCleared] = useState(false);
    const { t, lang, setLanguage } = useTranslation();

    useEffect(() => {
        // Load saved settings
        if (chrome.storage) {
            chrome.storage.local.get(['apiKey', 'provider', 'modelId']).then((result: { apiKey?: string; provider?: 'openai' | 'gemini'; modelId?: string }) => {
                if (result.apiKey) setApiKey(result.apiKey);
                if (result.provider) setProvider(result.provider);
                if (result.modelId) setModelId(result.modelId);
            });
        }
    }, []);

    const handleSave = () => {
        if (chrome.storage) {
            chrome.storage.local.set({ apiKey, provider, modelId }).then(() => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            });
        }
    };

    return (
        <div className="w-80 bg-white text-slate-900 font-sans p-0">
            <div className="bg-indigo-600 p-4 text-white flex items-center gap-2">
                <Key size={18} />
                <h1 className="font-bold text-lg">{t.settingsTitle}</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Language Selector */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                        <Globe size={12} />
                        {t.language}
                    </label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setLanguage('en')}
                            className={clsx(
                                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                lang === 'en' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                            )}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLanguage('ja')}
                            className={clsx(
                                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                lang === 'ja' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                            )}
                        >
                            日本語
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                        {t.provider}
                    </label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setProvider('openai')}
                            className={clsx(
                                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                provider === 'openai' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                            )}
                        >
                            OpenAI
                        </button>
                        <button
                            onClick={() => setProvider('gemini')}
                            className={clsx(
                                "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
                                provider === 'gemini' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                            )}
                        >
                            Gemini
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                        {t.apiKey}
                    </label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder={provider === 'openai' ? "sk-..." : "AIza..."}
                    />
                    <p className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>{t.storedLocally}</span>
                        <a
                            href={provider === 'openai' ? "https://platform.openai.com/api-keys" : "https://aistudio.google.com/app/apikey"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-600 underline"
                        >
                            {provider === 'openai' ? "Get OpenAI Key" : "Get Gemini Key"}
                        </a>
                    </p>
                </div>

                {/* ... inside Popup component ... */}
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex justify-between">
                        <span>{t.modelId}</span>
                        <span className="text-slate-400 font-normal normal-case">{t.optional}</span>
                    </label>

                    <div className="space-y-2">
                        <select
                            value={RECENT_MODELS.some(m => m.id === modelId) ? modelId : (modelId ? 'custom' : '')}
                            onChange={(e) => {
                                if (e.target.value !== 'custom') {
                                    setModelId(e.target.value);
                                } else {
                                    // Keep current custom value or clear if it was a preset
                                    if (RECENT_MODELS.some(m => m.id === modelId)) {
                                        setModelId('');
                                    }
                                }
                            }}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white appearance-none cursor-pointer"
                        >
                            <option value="">Default ({provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'})</option>
                            <optgroup label="OpenAI">
                                {RECENT_MODELS.filter(m => !m.id.startsWith('gemini')).map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Google Gemini">
                                {RECENT_MODELS.filter(m => m.id.startsWith('gemini')).map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </optgroup>
                            <option value="custom">Custom ID...</option>
                        </select>

                        {(modelId !== '' && !RECENT_MODELS.some(m => m.id === modelId)) && (
                            <input
                                type="text"
                                value={modelId}
                                onChange={(e) => setModelId(e.target.value)}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono animate-in fade-in"
                                placeholder="e.g. gemini-1.5-flash-002"
                                autoFocus
                            />
                        )}

                        {(modelId !== '' && !RECENT_MODELS.some(m => m.id === modelId)) && (
                            <p className="text-[10px] text-slate-400 mt-1">
                                Enter your specific model ID above.
                            </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleSave}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                >
                    {saved ? <Check size={18} /> : <Save size={18} />}
                    {saved ? t.saved : t.save}
                </button>

                {/* Cache Management Section */}
                <div className="pt-4 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                        Storage & Cache
                    </label>
                    <button
                        // @ts-ignore
                        onClick={async () => {
                            const { clearAllCache } = await import('../services/cache');
                            await clearAllCache();
                            setCacheCleared(true);
                            setTimeout(() => setCacheCleared(false), 2000);
                        }}
                        className="w-full py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-xs"
                    >
                        {cacheCleared ? <Check size={14} /> : <Trash2 size={14} />}
                        {cacheCleared ? "Cache Cleared" : "Clear AI Cache"}
                    </button>
                </div>
            </div>
        </div>
    );
}
