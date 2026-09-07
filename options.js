/**
 * Instagram Direct Photo Opener - Options Script
 */

const DEFAULT_SHORTCUT = {
  key: "i",
  code: "KeyI",
  altKey: true,
  ctrlKey: false,
  shiftKey: false,
  metaKey: false
};

let currentShortcut = { ...DEFAULT_SHORTCUT };
let isRecording = false;

const shortcutDisplay = document.getElementById("shortcutDisplay");
const recordBtn = document.getElementById("recordBtn");
const recordBtnText = document.getElementById("recordBtnText");
const resetShortcutBtn = document.getElementById("resetShortcutBtn");
const recordInstruction = document.getElementById("recordInstruction");
const openInBackgroundInput = document.getElementById("openInBackground");
const showToastInput = document.getElementById("showToast");
const videoActionSelect = document.getElementById("videoAction");
const testBox = document.getElementById("testBox");
const testStatus = document.getElementById("testStatus");
const saveNotice = document.getElementById("saveNotice");

// Load stored settings on open
chrome.storage.sync.get(["shortcut", "openInBackground", "showToast", "videoAction"], (res) => {
  if (res.shortcut) {
    currentShortcut = res.shortcut;
  }
  renderShortcut(currentShortcut);

  if (res.openInBackground !== undefined) {
    openInBackgroundInput.checked = res.openInBackground;
  }
  if (res.showToast !== undefined) {
    showToastInput.checked = res.showToast;
  } else {
    showToastInput.checked = true;
  }
  if (res.videoAction) {
    videoActionSelect.value = res.videoAction;
  }
});

// Render shortcut keys visually
function renderShortcut(sc, isTemporary = false) {
  shortcutDisplay.innerHTML = "";

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
    const badge = document.createElement("span");
    badge.className = "kbd-badge recording";
    badge.textContent = "Press key...";
    shortcutDisplay.appendChild(badge);
    return;
  }

  keys.forEach((k, index) => {
    const badge = document.createElement("span");
    badge.className = "kbd-badge" + (isTemporary ? " recording" : "");
    badge.textContent = k;
    shortcutDisplay.appendChild(badge);

    if (index < keys.length - 1) {
      const sep = document.createElement("span");
      sep.className = "kbd-separator";
      sep.textContent = "+";
      shortcutDisplay.appendChild(sep);
    }
  });
}

// Start / stop recording
recordBtn.addEventListener("click", () => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  isRecording = true;
  recordBtn.classList.add("recording");
  recordBtnText.textContent = "Cancel";
  recordInstruction.classList.remove("hidden");
  renderShortcut({ key: "" }, true);
}

function stopRecording() {
  isRecording = false;
  recordBtn.classList.remove("recording");
  recordBtnText.textContent = "Record Shortcut";
  recordInstruction.classList.add("hidden");
  renderShortcut(currentShortcut);
}

// Global key listener for recording
window.addEventListener("keydown", (e) => {
  if (isRecording) {
    e.preventDefault();
    e.stopPropagation();

    // Escape cancels recording
    if (e.key === "Escape") {
      stopRecording();
      return;
    }

    // Ignore standalone modifier presses
    const isModifier = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
    if (isModifier) {
      renderShortcut({
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        key: ""
      }, true);
      return;
    }

    // Capture complete shortcut
    currentShortcut = {
      key: e.key,
      code: e.code,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    };

    chrome.storage.sync.set({ shortcut: currentShortcut }, () => {
      stopRecording();
      showSaveNotice();
    });
    return;
  }

  // Testing shortcut on page
  if (matchesCurrentShortcut(e)) {
    e.preventDefault();
    flashTestSuccess();
  }
});

function matchesCurrentShortcut(e) {
  const sc = currentShortcut;
  if (!sc || !sc.key) return false;

  const keyMatches = (e.key && sc.key && e.key.toLowerCase() === sc.key.toLowerCase()) ||
                     (e.code && sc.code && e.code.toLowerCase() === sc.code.toLowerCase());
  if (!keyMatches) return false;

  if (!!sc.altKey !== e.altKey) return false;
  if (!!sc.ctrlKey !== e.ctrlKey) return false;
  if (!!sc.shiftKey !== e.shiftKey) return false;
  if (!!sc.metaKey !== e.metaKey) return false;

  return true;
}

// Reset button
resetShortcutBtn.addEventListener("click", () => {
  currentShortcut = { ...DEFAULT_SHORTCUT };
  chrome.storage.sync.set({ shortcut: currentShortcut }, () => {
    if (isRecording) stopRecording();
    renderShortcut(currentShortcut);
    showSaveNotice();
  });
});

// Preferences inputs
openInBackgroundInput.addEventListener("change", (e) => {
  chrome.storage.sync.set({ openInBackground: e.target.checked }, () => {
    showSaveNotice();
  });
});

showToastInput.addEventListener("change", (e) => {
  chrome.storage.sync.set({ showToast: e.target.checked }, () => {
    showSaveNotice();
  });
});

videoActionSelect.addEventListener("change", (e) => {
  chrome.storage.sync.set({ videoAction: e.target.value }, () => {
    showSaveNotice();
  });
});

// Save notice badge
let saveNoticeTimeout = null;
function showSaveNotice() {
  saveNotice.classList.add("visible");
  clearTimeout(saveNoticeTimeout);
  saveNoticeTimeout = setTimeout(() => {
    saveNotice.classList.remove("visible");
  }, 2200);
}

// Test box feedback
let testTimeout = null;
function flashTestSuccess() {
  testBox.classList.add("success");
  testStatus.textContent = "✓ Shortcut detected successfully!";
  clearTimeout(testTimeout);
  testTimeout = setTimeout(() => {
    testBox.classList.remove("success");
    testStatus.textContent = "Press your shortcut to test...";
  }, 2000);
}
