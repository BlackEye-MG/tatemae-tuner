/// <reference types="chrome" />
console.log('Tatemae Tuner Service Worker Start')

// Create the context menu on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "decode-tatemae",
        title: "Decode Tatemae (Meaning)",
        contexts: ["selection"]
    });

    chrome.contextMenus.create({
        id: "tune-tatemae",
        title: "Tune Tatemae (Polite)",
        contexts: ["selection"]
    });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if ((info.menuItemId === "decode-tatemae" || info.menuItemId === "tune-tatemae") && info.selectionText) {
        // OPEN LOGIC:
        // 1. Open Side Panel Synchronously (Required for User Gesture)
        // @ts-ignore
        if (chrome.sidePanel && chrome.sidePanel.open) {
            // @ts-ignore
            chrome.sidePanel.open({ windowId: tab?.windowId });
        }

        // 2. Save Action to Storage (Handoff)
        // The side panel will read this from storage on mount (or via change listener).
        const actionType = info.menuItemId === "decode-tatemae" ? 'DECODE_SELECTION' : 'TUNE_SELECTION';

        chrome.storage.local.set({
            pendingAction: {
                type: actionType,
                text: info.selectionText,
                timestamp: Date.now()
            }
        });
    }
});

