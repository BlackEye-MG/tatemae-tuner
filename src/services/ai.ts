import { buildPrompt } from '../utils/prompt';

interface AIConfig {
    apiKey: string;
    provider: 'openai' | 'gemini';
    modelId?: string;
}

/**
 * Fetches the stored configuration from chrome.storage.local
 */
export const getAIConfig = async (): Promise<AIConfig | null> => {
    // @ts-ignore - Chrome types might be missing in some envs
    if (typeof chrome === 'undefined' || !chrome.storage) return null;

    // @ts-ignore
    const result = await chrome.storage.local.get(['apiKey', 'provider', 'modelId']) as { apiKey?: string; provider?: 'openai' | 'gemini'; modelId?: string };
    if (result.apiKey) {
        return {
            apiKey: result.apiKey,
            provider: result.provider || 'openai', // Default to OpenAI
            modelId: result.modelId
        };
    }
    return null;
};

import { generateCacheKey, getCachedResponse, setCachedResponse } from './cache';

/**
 * Calls the AI Provider to generate the response.
 */
export const tuneText = async (
    input: string,
    mode: 'casual' | 'polite' | 'formal' | 'kyoto' | 'decode',
    config: AIConfig
): Promise<string> => {
    const systemPrompt = buildPrompt(input, mode);

    // Defaults
    const defaultOpenAI = 'gpt-4o-mini';
    const defaultGemini = 'gemini-2.5-flash';

    const modelToUse = config.modelId || (config.provider === 'openai' ? defaultOpenAI : defaultGemini);

    // 1. Generate Cache Key
    const cacheKey = generateCacheKey(input, mode, modelToUse);

    // 2. Check Cache
    const cachedResult = await getCachedResponse(cacheKey);
    if (cachedResult) {
        console.log(`[Cache Hit] Serving ${mode} version from cache.`);
        return cachedResult;
    }

    // 3. Call API
    let result: string;
    if (config.provider === 'openai') {
        result = await callOpenAI(systemPrompt, config.apiKey, modelToUse);
    } else {
        result = await callGemini(systemPrompt, config.apiKey, modelToUse);
    }

    // 4. Save to Cache (if successful return)
    if (!result.startsWith("Error:")) {
        await setCachedResponse(cacheKey, result);
    }

    return result;
};

/**
 * OpenAI API Caller
 */
const callOpenAI = async (prompt: string, apiKey: string, model: string): Promise<string> => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: prompt }
                ],
                max_tokens: 300
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API Request Failed');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || "Error: No response generated.";

    } catch (e: any) {
        console.error("OpenAI Call Failed", e);
        throw new Error(e.message || "Failed to connect to OpenAI.");
    }
}

/**
 * Gemini API Caller
 */
const callGemini = async (prompt: string, apiKey: string, model: string): Promise<string> => {
    try {
        // Use custom model ID or default to gemini-2.5-flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API Request Failed');
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Error: No response generated.";

    } catch (e: any) {
        console.error("Gemini Call Failed", e);
        throw new Error(e.message || "Failed to connect to Google Gemini.");
    }
}
