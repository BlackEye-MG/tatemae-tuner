/**
 * Security Utilities - Zero Trust Implementation
 */

// Maximum safe length for input to prevent token exhaustion and potential buffer issues
export const MAX_INPUT_LENGTH = 200; // Matches the Free Tier limit

// Blocklist of keywords that might attempt to override system instructions
// This is a basic client-side filter; the LLM system prompt is the final defense.
const INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /system prompt/i,
    /you are not a/i,
    /override/i
];

/**
 * Validates and sanitizes user input.
 * Throws an error if input is unsafe or invalid.
 */
export const validateInput = (input: string): string => {
    if (!input || typeof input !== 'string') {
        throw new Error("Invalid input format.");
    }

    const trimmed = input.trim();

    if (trimmed.length === 0) {
        throw new Error("Input cannot be empty.");
    }

    if (trimmed.length > MAX_INPUT_LENGTH) {
        throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters.`);
    }

    // Check for known projection injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(trimmed)) {
            throw new Error("Security Alert: Potential prompt injection detected.");
        }
    }

    // Escape HTML/XML-like characters to prevent tag spoofing in our XML-delimited prompt
    return escapeXML(trimmed);
};

/**
 * Escapes characters that could be used to break out of XML delimiters in the prompt.
 */
function escapeXML(str: string): string {
    return str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
