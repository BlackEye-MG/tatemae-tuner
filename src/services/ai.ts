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
 * Calls the AI Provider to generate the response, supporting streaming.
 */
export const tuneText = async (
    input: string,
    mode: 'casual' | 'polite' | 'formal' | 'kyoto' | 'decode',
    config: AIConfig,
    onChunk: (text: string) => void
): Promise<void> => {
    const systemPrompt = buildPrompt(input, mode);

    // Defaults
    const defaultOpenAI = 'gpt-4o-mini';
    const defaultGemini = 'gemini-1.5-flash-latest'; // Use a known stable streaming model

    const modelToUse = config.modelId || (config.provider === 'openai' ? defaultOpenAI : defaultGemini);

    // 1. Generate Cache Key
    const cacheKey = generateCacheKey(input, mode, modelToUse);

    // 2. Check Cache
    const cachedResult = await getCachedResponse(cacheKey);
    if (cachedResult) {
        console.log(`[Cache Hit] Serving ${mode} version from cache.`);
        onChunk(cachedResult);
        return;
    }

    // 3. Call API and Stream
    let fullResponse = "";
    const handleChunk = (chunk: string) => {
        fullResponse += chunk;
        onChunk(chunk);
    };

    if (config.provider === 'openai') {
        await callOpenAI(systemPrompt, config.apiKey, modelToUse, handleChunk);
    } else {
        await callGemini(systemPrompt, config.apiKey, modelToUse, handleChunk);
    }

    // 4. Save to Cache after stream is complete
    if (!fullResponse.startsWith("Error:")) {
        await setCachedResponse(cacheKey, fullResponse.trim());
    }
};

/**
 * OpenAI API Caller with Streaming
 */
const callOpenAI = async (prompt: string, apiKey: string, model: string, onChunk: (text: string) => void): Promise<void> => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: prompt }],
                max_tokens: 300,
                stream: true // Enable streaming
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API Request Failed');
        }

        if (!response.body) {
            throw new Error("No response body from OpenAI.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last, possibly incomplete line

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data.trim() === '[DONE]') {
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const chunk = parsed.choices?.[0]?.delta?.content;
                        if (chunk) {
                            onChunk(chunk);
                        }
                    } catch (e) {
                        console.error("Failed to parse stream chunk:", e);
                    }
                }
            }
        }
    } catch (e: any) {
        console.error("OpenAI Call Failed", e);
        onChunk(`Error: ${e.message || "Failed to connect to OpenAI."}`);
        throw e; // Re-throw to be caught by the caller
    }
}

/**
 * Gemini API Caller with Streaming
 */
const callGemini = async (prompt: string, apiKey: string, model: string, onChunk: (text: string) => void): Promise<void> => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API Request Failed');
        }

        if (!response.body) {
            throw new Error("No response body from Gemini.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    try {
                        const parsed = JSON.parse(data);
                        const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (chunk) {
                            onChunk(chunk);
                        }
                    } catch (e) {
                        console.error("Failed to parse stream chunk:", e);
                    }
                }
            }
        }
    } catch (e: any) {
        console.error("Gemini Call Failed", e);
        onChunk(`Error: ${e.message || "Failed to connect to Google Gemini."}`);
        throw e; // Re-throw to be caught by the caller
    }
}
