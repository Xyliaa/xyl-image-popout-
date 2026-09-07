/**
 * Instagram Direct Photo Opener - Service Worker (Background)
 */

const DEFAULT_SETTINGS = {
  shortcut: { key: "i", code: "KeyI", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false },
  openInBackground: false,
  showToast: true,
  videoAction: "new_tab"
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(["shortcut", "openInBackground", "showToast", "videoAction"]);
  const updates = {};
  if (!data.shortcut) updates.shortcut = DEFAULT_SETTINGS.shortcut;
  if (data.openInBackground === undefined) updates.openInBackground = DEFAULT_SETTINGS.openInBackground;
  if (data.showToast === undefined) updates.showToast = DEFAULT_SETTINGS.showToast;
  if (!data.videoAction) updates.videoAction = DEFAULT_SETTINGS.videoAction;
  if (Object.keys(updates).length > 0) await chrome.storage.sync.set(updates);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open_tab") {
    const url = message.url;
    const active = message.active !== undefined ? message.active : true;
    if (url) {
      chrome.tabs.create({ url, active }, (tab) => {
        sendResponse({ success: true, tabId: tab?.id });
      });
      return true;
    }
    sendResponse({ success: false, error: "No URL provided" });
  } else if (message.action === "fetch_media") {
    // Fetch Instagram media info with full host permissions and cookies
    fetch(`https://www.instagram.com/api/v1/media/${message.mediaId}/info/`, {
      headers: {
        "X-IG-App-ID": "936619743392459",
        "X-Requested-With": "XMLHttpRequest"
      },
      credentials: "include"
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (message.action === "open_options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  }
});
