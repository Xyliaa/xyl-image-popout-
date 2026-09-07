/**
 * Instagram Direct Photo Opener - Popup Script
 */

const popupShortcutDisplay = document.getElementById("popupShortcutDisplay");
const popupOpenInBackground = document.getElementById("popupOpenInBackground");
const openOptionsBtn = document.getElementById("openOptionsBtn");

// Load stored settings
chrome.storage.sync.get(["shortcut", "openInBackground"], (res) => {
  const sc = res.shortcut || {
    key: "i",
    code: "KeyI",
    altKey: true,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false
  };

  renderPopupShortcut(sc);

  if (res.openInBackground !== undefined) {
    popupOpenInBackground.checked = res.openInBackground;
  }
});

function renderPopupShortcut(sc) {
  popupShortcutDisplay.innerHTML = "";

  const keys = [];
  if (sc.ctrlKey) keys.push("Ctrl");
  if (sc.altKey) keys.push("Alt");
  if (sc.shiftKey) keys.push("Shift");
  if (sc.metaKey) keys.push(navigator.platform.includes("Mac") ? "⌘ Cmd" : "Win");

  if (sc.key) {
    let displayKey = sc.key;
    if (displayKey === " ") displayKey = "Space";
    else if (displayKey.length === 1) displayKey = displayKey.toUpperCase();
    keys.push(displayKey);
  }

  if (keys.length === 0) {
    keys.push("Alt", "I");
  }

  keys.forEach((k, index) => {
    const badge = document.createElement("span");
    badge.className = "kbd-badge";
    badge.textContent = k;
    popupShortcutDisplay.appendChild(badge);

    if (index < keys.length - 1) {
      const sep = document.createElement("span");
      sep.className = "kbd-separator";
      sep.textContent = "+";
      popupShortcutDisplay.appendChild(sep);
    }
  });
}

// Background toggle
popupOpenInBackground.addEventListener("change", (e) => {
  chrome.storage.sync.set({ openInBackground: e.target.checked });
});

// Open options page
openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
