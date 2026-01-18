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

// Handle OPEN_SETTINGS message

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {

    if (message.type === "OPEN_SETTINGS") {

        chrome.runtime.openOptionsPage();

    }

});





