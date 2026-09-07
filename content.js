/**
 * Direct Photo & Video Opener - Content Script
 * Supports Instagram & X (Twitter) full-size image extraction & video pop-out / Picture-in-Picture.
 */

(() => {
  const isTwitter = location.hostname.includes("x.com") || location.hostname.includes("twitter.com");
  const isInstagram = location.hostname.includes("instagram.com");

  let shortcut = { key: "i", code: "KeyI", altKey: true, ctrlKey: false, shiftKey: false, metaKey: false };
  let openInBackground = false;
  let showToast = true;
  let videoAction = "new_tab"; // "new_tab" or "pip"

  // Safe chrome.runtime message dispatcher
  function safeSendMessage(msg, callback) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(msg, (res) => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) {
            if (callback) callback(null);
          } else {
            if (callback) callback(res);
          }
        });
        return;
      }
    } catch (e) {
      // Context invalidated
    }
    if (callback) callback(null);
  }

  // Load settings safely
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(["shortcut", "openInBackground", "showToast", "videoAction"], (data) => {
        if (!data) return;
        if (data.shortcut) shortcut = data.shortcut;
        if (data.openInBackground !== undefined) openInBackground = data.openInBackground;
        if (data.showToast !== undefined) showToast = data.showToast;
        if (data.videoAction !== undefined) videoAction = data.videoAction;
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync") {
          if (changes.shortcut) shortcut = changes.shortcut.newValue;
          if (changes.openInBackground) openInBackground = changes.openInBackground.newValue;
          if (changes.showToast) showToast = changes.showToast.newValue;
          if (changes.videoAction) videoAction = changes.videoAction.newValue;
        }
      });
    }
  } catch (e) {}

  // Track mouse coordinates
  let mouseX = 0, mouseY = 0;
  window.addEventListener("mousemove", (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { passive: true });

  // Key listener
  window.addEventListener("keydown", async (e) => {
    const el = document.activeElement;
    const isTyping = el && (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable ||
      el.getAttribute("role") === "textbox"
    );
    if (isTyping && !e.altKey && !e.ctrlKey && !e.metaKey) return;

    const keyMatch = (e.key && shortcut.key && e.key.toLowerCase() === shortcut.key.toLowerCase()) ||
                     (e.code && shortcut.code && e.code.toLowerCase() === shortcut.code.toLowerCase());
    if (!keyMatch || !!shortcut.altKey !== e.altKey || !!shortcut.ctrlKey !== e.ctrlKey ||
        !!shortcut.shiftKey !== e.shiftKey || !!shortcut.metaKey !== e.metaKey) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (isTwitter) {
      handleTwitterTrigger();
    } else {
      handleInstagramTrigger();
    }
  }, true);

  /* ==========================================================================
     X (TWITTER) RESOLUTION LOGIC
     ========================================================================== */

  async function handleTwitterTrigger() {
    const target = findTwitterTargetInfo();
    const { domVideo, isVideoContext, imgUrl } = target;

    notify(isVideoContext ? "Locating high-res video..." : "Locating original full-size photo...");

    // 1. If video & Picture-in-Picture action chosen
    if (isVideoContext && videoAction === "pip" && domVideo) {
      if (document.pictureInPictureEnabled) {
        try {
          if (document.pictureInPictureElement === domVideo) {
            await document.exitPictureInPicture();
            notify("Exited Picture-in-Picture");
          } else {
            await domVideo.requestPictureInPicture();
            notify("Popped out video into Picture-in-Picture!");
          }
          return;
        } catch (pipErr) {}
      }
    }

    // 2. Video direct URL
    if (isVideoContext && domVideo) {
      const videoSrc = domVideo.src || domVideo.currentSrc || domVideo.querySelector("source")?.src;
      if (videoSrc && !videoSrc.startsWith("blob:")) {
        openMediaUrl(videoSrc, "video");
        return;
      }
      // If streamed blob video, fall back to max-resolution poster
      if (domVideo.poster) {
        const fullPoster = getMaxTwitterUrl(domVideo.poster);
        openMediaUrl(fullPoster, "photo");
        return;
      }
    }

    // 3. Photo original URL
    if (imgUrl) {
      const fullUrl = getMaxTwitterUrl(imgUrl);
      openMediaUrl(fullUrl, "photo");
      return;
    }

    notify("No photo or video found under cursor or on screen", true);
  }

  function findTwitterTargetInfo() {
    let hoveredEl = null;
    if (mouseX || mouseY) {
      hoveredEl = document.elementFromPoint(mouseX, mouseY);
    }

    // Check hovered video
    const hoveredVideo = hoveredEl ? (hoveredEl.tagName === "VIDEO" ? hoveredEl : hoveredEl.closest("video") || hoveredEl.parentElement?.querySelector("video")) : null;

    // Check hovered image
    let hoveredImg = null;
    if (hoveredEl) {
      if (hoveredEl.tagName === "IMG" && isValidTwitterImage(hoveredEl)) {
        hoveredImg = hoveredEl;
      } else {
        const parentImg = hoveredEl.closest("[data-testid='tweetPhoto']")?.querySelector("img") ||
                          hoveredEl.closest("article")?.querySelector("img[src*='twimg.com/media/']");
        if (parentImg && isValidTwitterImage(parentImg)) hoveredImg = parentImg;
      }
    }

    // Check open modal dialog / photo view on X
    const modal = document.querySelector("div[aria-modal='true'], div[role='dialog']");
    let modalImg = null;
    let modalVideo = null;
    if (modal) {
      modalVideo = modal.querySelector("video");
      modalImg = modal.querySelector("img[src*='twimg.com/media/'], div[data-testid='tweetPhoto'] img");
    }

    // Check visible tweet in timeline
    let visibleTweetImg = null;
    let visibleTweetVideo = null;
    const tweets = Array.from(document.querySelectorAll("article[data-testid='tweet']"));
    let maxVisibleH = 0;
    let bestTweet = null;
    for (const t of tweets) {
      const r = t.getBoundingClientRect();
      const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      if (h > maxVisibleH) {
        maxVisibleH = h;
        bestTweet = t;
      }
    }

    if (bestTweet) {
      visibleTweetVideo = bestTweet.querySelector("video");
      visibleTweetImg = bestTweet.querySelector("div[data-testid='tweetPhoto'] img, img[src*='twimg.com/media/']");
    }

    const domVideo = hoveredVideo || modalVideo || visibleTweetVideo;
    const isVideoContext = !!domVideo && (!hoveredImg || !!hoveredVideo);

    const targetImg = hoveredImg || modalImg || visibleTweetImg || document.querySelector("img[src*='twimg.com/media/']");
    const imgUrl = targetImg ? (targetImg.currentSrc || targetImg.src || "") : null;

    return { domVideo, isVideoContext, imgUrl };
  }

  function isValidTwitterImage(img) {
    if (!img) return false;
    const src = img.currentSrc || img.src || "";
    // Filter out tiny emojis, badges, or icons
    const w = img.offsetWidth || img.naturalWidth || 0;
    const h = img.offsetHeight || img.naturalHeight || 0;
    if ((w > 0 && w < 48) || (h > 0 && h < 48)) return false;
    return src.includes("twimg.com");
  }

  /**
   * Convert Twitter/X image URL into 100% full original resolution (name=orig)
   */
  function getMaxTwitterUrl(url) {
    if (!url) return "";

    // Profile picture: strip size descriptor (_normal, _bigger, _mini, _reasonably_small)
    if (url.includes("/profile_images/")) {
      return url.replace(/_(?:bigger|normal|mini|reasonably_small|\d+x\d+)(\.[^/_?#]+)(?:[?#].*)?$/i, "$1");
    }

    // Profile banner: strip dimension suffix (/1500x500)
    if (url.includes("/profile_banners/")) {
      return url.replace(/\/\d+x\d+(?:[?#].*)?$/, "");
    }

    // Media photo: replace trailing format or name with name=orig
    if (url.includes("twimg.com")) {
      let u = url;
      // Replace :large or :medium if path-based
      u = u.replace(/:([a-z0-9_]+)(?:\?|$)/i, "?name=$1");
      if (/[?&]name=[^&#]*/.test(u)) {
        return u.replace(/([?&])name=[^&#]*/, "$1name=orig");
      } else {
        const sep = u.includes("?") ? "&" : "?";
        return u + sep + "name=orig";
      }
    }

    return url;
  }

  /* ==========================================================================
     INSTAGRAM RESOLUTION LOGIC
     ========================================================================== */

  async function handleInstagramTrigger() {
    const targetInfo = findInstagramTargetInfo();
    const { container, domUrl, currentSrc, domVideo, isVideoContext } = targetInfo;
    const shortcode = getShortcode(container);
    const slideIndex = getSlideIndex(container);

    notify(isVideoContext ? "Locating high-res video..." : "Locating original full-size photo...");

    // 1. Fetch media from Instagram's API
    let mediaResult = null;
    if (shortcode) {
      mediaResult = await fetchMediaFromApi(shortcode, slideIndex, currentSrc, isVideoContext);
    }

    // 2. Fallback to DOM if API did not resolve
    if (!mediaResult || !mediaResult.url) {
      if (domVideo && (domVideo.src || domVideo.currentSrc) && !domVideo.src.startsWith("blob:")) {
        mediaResult = { url: domVideo.src || domVideo.currentSrc, type: "video" };
      } else if (domUrl) {
        mediaResult = { url: domUrl, type: isVideoContext ? "video" : "photo" };
      }
    }

    // 3. Handle Video Picture-in-Picture if requested by user
    if (mediaResult?.type === "video" && videoAction === "pip" && domVideo) {
      if (document.pictureInPictureEnabled) {
        try {
          if (document.pictureInPictureElement === domVideo) {
            await document.exitPictureInPicture();
            notify("Exited Picture-in-Picture window");
          } else {
            await domVideo.requestPictureInPicture();
            notify("Popped out video into Picture-in-Picture!");
          }
          return;
        } catch (pipErr) {}
      }
    }

    if (!mediaResult || !mediaResult.url) {
      notify("No photo or video found under cursor or on screen", true);
      return;
    }

    // 4. Open direct media in new tab
    const isVideo = mediaResult.type === "video";
    openMediaUrl(mediaResult.url, isVideo ? "video" : "photo");
  }

  function findInstagramTargetInfo() {
    let container = null;
    let hoveredImg = null;
    let hoveredVideo = null;

    if (mouseX || mouseY) {
      const hovered = document.elementFromPoint(mouseX, mouseY);
      if (hovered) {
        hoveredVideo = (hovered.tagName === "VIDEO" ? hovered : hovered.closest("video") || hovered.parentElement?.querySelector("video")) || null;
        hoveredImg = getValidImage(hovered);
        container = hovered.closest("article, [role='dialog'], [role='presentation'], li");
      }
    }

    if (!container) {
      container = document.querySelector("div[role='dialog'] article, div[role='dialog'], main article");
    }

    if (!container) {
      const articles = Array.from(document.querySelectorAll("article"));
      let maxH = 0;
      for (const art of articles) {
        const r = art.getBoundingClientRect();
        const h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        if (h > maxH) { maxH = h; container = art; }
      }
    }

    const domVideo = hoveredVideo || (container ? container.querySelector("video") : null) || document.querySelector("main video");
    const isReelPage = /\/(reel|reels)\//.test(location.pathname);
    const isVideoContext = isReelPage || !!hoveredVideo || !!domVideo;

    const img = hoveredImg || (container ? getValidImageFromContainer(container) : null) || getLargestImageOnPage();
    const currentSrc = (hoveredVideo && (hoveredVideo.src || hoveredVideo.currentSrc)) || (img ? (img.currentSrc || img.src || "") : "");
    const domUrl = img ? getDomHighestRes(img) : (domVideo?.poster || null);

    return { container, domUrl, currentSrc, domVideo, isVideoContext };
  }

  function shortcodeToMediaId(sc) {
    const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let id = 0n;
    for (const c of sc) {
      const idx = alpha.indexOf(c);
      if (idx === -1) return null;
      id = id * 64n + BigInt(idx);
    }
    return id.toString();
  }

  function pickBestCandidate(candidates) {
    if (!candidates || candidates.length === 0) return null;

    const isUnprocessed = (url) => {
      const stpMatch = url.match(/[?&]stp=([^&]+)/);
      if (!stpMatch) return true;
      const stp = stpMatch[1];
      return !/(_p\d+x\d+|_s\d+x\d+|_c\d+\.)/.test(stp);
    };

    const sorted = [...candidates].sort((a, b) => {
      const aUn = isUnprocessed(a.url);
      const bUn = isUnprocessed(b.url);
      if (aUn && !bUn) return -1;
      if (!aUn && bUn) return 1;

      const sizeA = (a.width || 0) * (a.height || 0) || a.width || 0;
      const sizeB = (b.width || 0) * (b.height || 0) || b.width || 0;
      return sizeB - sizeA;
    });

    return sorted[0]?.url || null;
  }

  async function fetchMediaFromApi(shortcode, slideIndex, currentSrc, isVideoContext) {
    try {
      const mediaId = shortcodeToMediaId(shortcode);
      if (!mediaId) return null;

      let data = null;
      try {
        const res = await fetch(`/api/v1/media/${mediaId}/info/`, {
          headers: {
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest"
          },
          credentials: "include"
        });
        if (res.ok) data = await res.json();
      } catch (e) {}

      if (!data) {
        data = await new Promise((resolve) => {
          safeSendMessage({ action: "fetch_media", mediaId }, (res) => {
            resolve(res?.success && res?.data ? res.data : null);
          });
        });
      }

      const item = data?.items?.[0];
      if (!item) return null;

      if (item.carousel_media && item.carousel_media.length > 0) {
        let slide = null;
        if (currentSrc) {
          const fnMatch = currentSrc.match(/\/([^\/?#]+\.(?:jpg|jpeg|png|webp|mp4))/i);
          const fileName = fnMatch ? fnMatch[1] : null;
          if (fileName) {
            slide = item.carousel_media.find(m =>
              m.image_versions2?.candidates?.some(c => c.url.includes(fileName)) ||
              m.video_versions?.some(v => v.url.includes(fileName))
            );
          }
        }

        if (!slide) {
          slide = item.carousel_media[slideIndex] || item.carousel_media[0];
        }

        const isSlideVideo = slide.media_type === 2 || (slide.video_versions && slide.video_versions.length > 0);
        if (isSlideVideo && (isVideoContext || slide.media_type === 2)) {
          return { url: slide.video_versions?.[0]?.url || null, type: "video" };
        }

        return {
          url: pickBestCandidate(slide.image_versions2?.candidates) || slide.video_versions?.[0]?.url || null,
          type: isSlideVideo ? "video" : "photo"
        };
      }

      const isItemVideo = item.media_type === 2 || (item.video_versions && item.video_versions.length > 0);
      if (isItemVideo && (isVideoContext || item.media_type === 2)) {
        return { url: item.video_versions?.[0]?.url || null, type: "video" };
      }

      return {
        url: pickBestCandidate(item.image_versions2?.candidates) || item.video_versions?.[0]?.url || null,
        type: isItemVideo ? "video" : "photo"
      };
    } catch (e) {
      return null;
    }
  }

  function getShortcode(container) {
    const pageMatch = location.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (pageMatch) return pageMatch[2];

    if (container) {
      const link = container.querySelector("a[href*='/p/'], a[href*='/reel/']");
      if (link) {
        const m = (link.getAttribute("href") || "").match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
        if (m) return m[2];
      }
    }

    const anyLink = document.querySelector("article a[href*='/p/'], article a[href*='/reel/']");
    if (anyLink) {
      const m = (anyLink.getAttribute("href") || "").match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      if (m) return m[2];
    }

    return null;
  }

  function getSlideIndex(container) {
    const params = new URLSearchParams(location.search);
    const idx = params.get("img_index");
    if (idx) {
      const n = parseInt(idx, 10);
      if (!isNaN(n) && n >= 1) return n - 1;
    }

    if (container) {
      const slides = Array.from(container.querySelectorAll("ul li"));
      if (slides.length > 1) {
        const cRect = container.getBoundingClientRect();
        const mid = cRect.left + cRect.width / 2;
        let minDiff = Infinity, bestIdx = 0;
        slides.forEach((s, i) => {
          const r = s.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const diff = Math.abs((r.left + r.width / 2) - mid);
            if (diff < minDiff) { minDiff = diff; bestIdx = i; }
          }
        });
        return bestIdx;
      }
    }

    return 0;
  }

  function getValidImageFromContainer(container) {
    const slides = Array.from(container.querySelectorAll("ul li"));
    if (slides.length > 1) {
      const idx = getSlideIndex(container);
      const active = slides[idx] || slides[0];
      const img = Array.from(active.querySelectorAll("img")).find(isValidPostImage);
      if (img) return img;
    }
    return Array.from(container.querySelectorAll("img")).find(isValidPostImage);
  }

  function getValidImage(el) {
    if (!el) return null;
    if (el.tagName === "IMG" && isValidPostImage(el)) return el;
    const parent = el.parentElement;
    if (parent) {
      const img = parent.querySelector("img");
      if (img && isValidPostImage(img)) return img;
    }
    return null;
  }

  function isValidPostImage(img) {
    const w = img.offsetWidth || img.naturalWidth || 0;
    const h = img.offsetHeight || img.naturalHeight || 0;
    if ((w > 0 && w < 160) || (h > 0 && h < 160)) return false;
    const alt = (img.getAttribute("alt") || "").toLowerCase();
    return !alt.includes("profile picture") && !alt.includes("profile photo");
  }

  function getLargestImageOnPage() {
    const imgs = Array.from(document.querySelectorAll("img")).filter(isValidPostImage);
    imgs.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight));
    return imgs[0] || null;
  }

  function getDomHighestRes(img) {
    const srcset = img.getAttribute("srcset") || img.srcset;
    if (srcset) {
      const candidates = srcset.split(/,\s*(?=https?:\/\/)/);
      let bestUrl = "", maxW = 0;
      for (const item of candidates) {
        const match = item.trim().match(/^(https?:\/\/\S+)(?:\s+(\d+)w)?$/);
        if (match) {
          const w = parseInt(match[2], 10) || 0;
          if (w >= maxW) { maxW = w; bestUrl = match[1]; }
        }
      }
      if (bestUrl) return bestUrl.replace(/&amp;/g, "&");
    }
    return (img.currentSrc || img.src || "").replace(/&amp;/g, "&");
  }

  /* ==========================================================================
     COMMON HELPERS
     ========================================================================== */

  function openMediaUrl(url, type = "photo") {
    safeSendMessage({ action: "open_tab", url, active: !openInBackground }, (res) => {
      if (!res || !res.success) {
        window.open(url, "_blank");
      }
      notify(type === "video" ? "Opening direct high-res video (MP4)..." : "Opening full-size photo...");
    });
  }

  let toastTimer = null;
  function notify(text, isError = false) {
    if (!showToast) return;
    let toast = document.getElementById("ig-photo-opener-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ig-photo-opener-toast";
      document.body.appendChild(toast);
    }
    toast.className = "ig-photo-opener-toast" + (isError ? " error" : "") + " show";
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }
})();
