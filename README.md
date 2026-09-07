# Xyl Image Popout

<p align="center">
  <strong>Instantly open the direct, uncompressed original photo or video from Instagram and X (Twitter) with a single hotkey.</strong>
</p>

<p align="center">
  <a href="https://github.com/Xyliaa/xyl-image-popout-/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest_Release_(v1.0.0)-2ea44f?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download Latest Release">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square" alt="Version 1.0.0">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License MIT">
  <img src="https://img.shields.io/badge/Platforms-Instagram_•_X_(Twitter)-purple?style=flat-square" alt="Platforms">
</p>

---

## ⚡ Quick Install (No Git Required)

1. **[Download the `xyl-image-popout-v1.0.0.zip` file](https://github.com/Xyliaa/xyl-image-popout-/releases/latest)** and extract it to any folder on your computer.
2. In Google Chrome, go to `chrome://extensions` in your address bar.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left corner) and select your extracted folder.
5. You're ready! Hover over any photo or video on Instagram or X and press **<kbd>Alt</kbd> + <kbd>I</kbd>**.

---

## ✨ Features

| Platform | What It Does | Resolution |
| :--- | :--- | :--- |
| **Instagram** | Bypasses 1080x1080 preview downsampling and queries the internal media endpoint | **Full original upload** (`dst-jpegr_e35_tt6`, 1MB+) |
| **Instagram Carousels** | Detects the active slide you're viewing (e.g. `?img_index=1`) | Exact photo of the current slide |
| **X (Twitter)** | Transforms tweet image URLs to the master original copy | **100% original camera resolution** (`name=orig`) |
| **X Grids** | Detects the exact photo your mouse is hovering over in 2, 3, or 4-photo grids | The specific photo under your cursor |
| **Videos & Reels** | Extracts direct uncompressed `.mp4` video files | Full HD / 1080p source video |
| **Picture-in-Picture** | Allows popping videos into a floating Picture-in-Picture window | Floating PiP window |

---

## 🚀 How to Use

### On Instagram:
- Open any post, reel, or carousel on [instagram.com](https://www.instagram.com).
- Hover over the image/video and press **<kbd>Alt</kbd> + <kbd>I</kbd>**.
- The full-size uncompressed file opens immediately in a new tab!

### On X (Twitter):
- Open any post or timeline on [x.com](https://x.com) or [twitter.com](https://twitter.com).
- Hover over any photo or video and press **<kbd>Alt</kbd> + <kbd>I</kbd>**.
- The untouched full-resolution original image (`name=orig`) opens in a new tab!

---

## ⚙️ Customization

Click the extension icon in your Chrome toolbar or right-click it and choose **Options**:

- **Custom Hotkey**: Click **Record Shortcut** and press any key combination (e.g. <kbd>Alt</kbd> + <kbd>I</kbd>, <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>, or single keys).
- **Tab Behavior**: Choose whether images open in the foreground or in a background tab so you can keep browsing without losing your place.
- **Video Pop-Out Action**:
  - *Open direct MP4 video in new tab* (Default: native player with download, speed, loop, and full-screen controls).
  - *Picture-in-Picture floating window* (pops the video out into a floating window over your desktop).
- **On-Screen Notifications**: Toggle the subtle confirmation toast on or off.

---

## 🔒 Privacy

- **100% Client-Side**: This extension operates entirely inside your local browser.
- **No External Servers**: Does not send data, links, or telemetry to any third-party servers.
- **Open Source**: Complete code is transparent and available in this repository under the MIT License.
