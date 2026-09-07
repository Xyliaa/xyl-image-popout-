# Direct Photo & Video Opener (Instagram & X)

A Google Chrome Extension (Manifest V3) that allows you to instantly open the direct, highest-resolution photo or video from **Instagram** and **X (Twitter)** in a new tab using a single customizable hotkey.

---

## Features

- **Instagram Original Full-Resolution**: Automatically queries Instagram's internal media endpoint to extract the uncropped, unprocessed full-size original photo (`stp=dst-jpegr_e35_tt6`, 1MB+) rather than the 1080x1080 web preview.
- **X (Twitter) Original Full-Resolution**: Automatically transforms `pbs.twimg.com` images into their 100% original, uncompressed camera resolution using `name=orig` (supports tweet photos, multi-photo grids, profile pictures, and banners).
- **Instagram Carousel Support (`?img_index=X`)**: Accurately detects which slide you are currently viewing in a multi-image carousel post and opens that exact photo.
- **Video & Reel Pop-Out Support**:
  - Automatically detects when you are looking at or hovering over a Video, Reel, or video slide.
  - Extracts the **direct uncompressed high-definition `.mp4` video URL**.
  - Configurable in Settings: choose between **"Open direct MP4 video in new tab"** or **"Picture-in-Picture floating window"**.
- **Smart Target Detection**:
  - Works when hovering your mouse over any image or post.
  - Bypasses Instagram's transparent overlay elements (`div._aagw`) designed to block right-clicks.
  - If not hovering, automatically detects the post opened in a popup modal/lightbox or the primary post visible on screen in your feed.
- **Customizable Hotkey**:
  - Default shortcut: <kbd>Alt</kbd> + <kbd>I</kbd>.
  - Built-in interactive recorder in Settings allows you to set any combination (e.g., <kbd>Alt</kbd> + <kbd>I</kbd>, <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>, or single keys).
- **Background Tab Option**: Choose whether to switch to the new tab immediately or open it silently in the background so you can keep browsing.
- **Visual Feedback**: Sleek, non-intrusive on-screen notification toast confirming the media has been opened.

---

## Installation Guide (Chrome)

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the extension folder (or the unzipped folder).
6. The extension will now appear in your list of extensions and in your Chrome toolbar!

---

## How to Use

### On Instagram:
1. Open any post, reel, or carousel (e.g. `https://www.instagram.com/p/Dc8iq-XidsN/?img_index=1`).
2. Hover over the photo/video and press **<kbd>Alt</kbd> + <kbd>I</kbd>**.
3. The original full-size photo or direct MP4 video will open in a new tab!

### On X (Twitter):
1. Open any tweet with images or videos on `x.com` (or `twitter.com`).
2. Hover over the photo or video and press **<kbd>Alt</kbd> + <kbd>I</kbd>**.
3. The original full-size photo (`name=orig`) or direct video will open in a new tab!

---

## Customizing Your Hotkey & Preferences

1. Click the extension icon in your Chrome toolbar.
2. Click **⚙️ Change Hotkey & Settings** (or right-click the extension icon and choose **Options**).
3. Click **Record Shortcut**, press your preferred key combination on your keyboard, and it will be automatically saved.
4. You can also toggle:
   - **Open in Background Tab**: Keep your place on Instagram / X while loading images in new tabs.
   - **Video Pop-Out Action**: Choose between new tab or Picture-in-Picture floating window.
   - **Show In-Page Notification**: Toggle the confirmation toast on or off.
