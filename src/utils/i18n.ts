import { useState, useEffect } from 'react';

type Language = 'en' | 'ja';

export const translations = {
    en: {
        settingsTitle: "Tatemae Settings",
        provider: "AI Provider",
        apiKey: "API Key",
        storedLocally: "Stored locally on device.",
        getKey: "Get Key",
        modelId: "Model ID",
        optional: "(Optional)",
        leaveEmpty: "Leave empty to use default.",
        save: "Save Settings",
        saved: "Saved!",
        language: "Language",

        // Side Panel
        tune: "Tune",
        decode: "Decode",
        honneDraft: "Honne (Draft)",
        tatemaeSource: "Tatemae (Source)",
        politenessLevel: "Politeness Level",
        tuneIt: "Tune it",
        tuning: "Tuning...",
        decodeMeaning: "Decode Meaning",
        decoding: "Decoding...",
        honneMeaning: "Honne (True Meaning)",
        tatemaeResult: "Tatemae (Result)",
        placeholderTune: "Type your rough draft here... (e.g. 'I can't do tuesday')",
        placeholderDecode: "Paste the polite text you want to decode...",

        // Modes
        casual: "Casual",
        polite: "Polite",
        formal: "Formal",
        kyoto: "Kyoto"
    },
    ja: {
        settingsTitle: "設定",
        provider: "AIプロバイダー",
        apiKey: "APIキー",
        storedLocally: "デバイスにローカル保存されます。",
        getKey: "キーを取得",
        modelId: "モデルID",
        optional: "(任意)",
        leaveEmpty: "デフォルトを使用する場合は空欄。",
        save: "設定を保存",
        saved: "保存しました！",
        language: "言語",

        // Side Panel
        tune: "変換",
        decode: "解読",
        honneDraft: "本音 (下書き)",
        tatemaeSource: "建前 (入力)",
        politenessLevel: "丁寧さレベル",
        tuneIt: "変換する",
        tuning: "変換中...",
        decodeMeaning: "本音を解読",
        decoding: "解読中...",
        honneMeaning: "本音 (真意)",
        tatemaeResult: "建前 (結果)",
        placeholderTune: "下書きを入力してください... (例: '火曜は無理')",
        placeholderDecode: "解読したい建前文を貼り付けてください...",

        // Modes
        casual: "カジュアル",
        polite: "丁寧",
        formal: "尊敬/謙譲",
        kyoto: "京都風"
    }
};

export const useTranslation = () => {
    const [lang, setLang] = useState<Language>('en');

    useEffect(() => {
        // Load initial language
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['language']).then((result) => {
                if (result.language) {
                    setLang(result.language as Language);
                }
            });

            // Listen for changes
            const handleChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
                if (changes.language) {
                    setLang(changes.language.newValue as Language);
                }
            };
            chrome.storage.onChanged.addListener(handleChange);
            return () => chrome.storage.onChanged.removeListener(handleChange);
        }
    }, []);

    const setLanguage = (newLang: Language) => {
        setLang(newLang);
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ language: newLang });
        }
    };

    return {
        t: translations[lang],
        lang,
        setLanguage
    };
};
