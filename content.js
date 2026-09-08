/**
 * Direct Photo & Video Opener - Content Script
 * Supports Instagram (Posts, Carousels, Stories, Reels) & X (Twitter).
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

    const hoveredVideo = hoveredEl ? (hoveredEl.tagName === "VIDEO" ? hoveredEl : hoveredEl.closest("video") || hoveredEl.parentElement?.querySelector("video")) : null;

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

    const modal = document.querySelector("div[aria-modal='true'], div[role='dialog']");
    let modalImg = null;
    let modalVideo = null;
    if (modal) {
      modalVideo = modal.querySelector("video");
      modalImg = modal.querySelector("img[src*='twimg.com/media/'], div[data-testid='tweetPhoto'] img");
    }

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
    const w = img.offsetWidth || img.naturalWidth || 0;
    const h = img.offsetHeight || img.naturalHeight || 0;
    if ((w > 0 && w < 48) || (h > 0 && h < 48)) return false;
    return src.includes("twimg.com");
  }

  function getMaxTwitterUrl(url) {
    if (!url) return "";
    if (url.includes("/profile_images/")) {
      return url.replace(/_(?:bigger|normal|mini|reasonably_small|\d+x\d+)(\.[^/_?#]+)(?:[?#].*)?$/i, "$1");
    }
    if (url.includes("/profile_banners/")) {
      return url.replace(/\/\d+x\d+(?:[?#].*)?$/, "");
    }
    if (url.includes("twimg.com")) {
      let u = url.replace(/:([a-z0-9_]+)(?:\?|$)/i, "?name=$1");
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
    // 1. Dedicated handler for Instagram Stories
    if (location.pathname.startsWith("/stories/")) {
      return handleInstagramStoriesTrigger();
    }

    // 2. Feed, single post, reel, or modal
    const targetInfo = findInstagramTargetInfo();
    const { container, domUrl, currentSrc, domVideo, isVideoContext, shortcode, slideIndex, hasExplicitIndex } = targetInfo;

    notify(isVideoContext ? "Locating high-res video..." : "Locating original full-size photo...");

    // Fetch media from Instagram's API using shortcode
    let mediaResult = null;
    if (shortcode) {
      mediaResult = await fetchMediaFromApi(shortcode, slideIndex, currentSrc, isVideoContext, hasExplicitIndex);
    }

    // Fallback strictly to container's DOM media
    if (!mediaResult || !mediaResult.url) {
      if (domVideo && (domVideo.src || domVideo.currentSrc) && !domVideo.src.startsWith("blob:")) {
        mediaResult = { url: domVideo.src || domVideo.currentSrc, type: "video" };
      } else if (domUrl) {
        mediaResult = { url: domUrl, type: isVideoContext ? "video" : "photo" };
      }
    }

    // Picture-in-Picture for video
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
      notify("No photo or video found in this post", true);
      return;
    }

    const isVideo = mediaResult.type === "video";
    openMediaUrl(mediaResult.url, isVideo ? "video" : "photo");
  }

  /* ==========================================================================
     INSTAGRAM STORIES HANDLER
     ========================================================================== */

  async function handleInstagramStoriesTrigger() {
    notify("Locating story media...");

    const storyMedia = getActiveStoryMedia();
    if (!storyMedia) {
      notify("No active story media found on screen", true);
      return;
    }

    // Check if the current URL has a numeric story ID
    const storyIdMatch = location.pathname.match(/\/stories\/[^\/]+\/(\d+)/);
    const storyId = storyIdMatch ? storyIdMatch[1] : null;

    let finalUrl = null;
    let isVideo = storyMedia.type === "video";

    // Try fetching unprocessed original media via story mediaId if available
    if (storyId) {
      try {
        let data = null;
        try {
          const res = await fetch(`/api/v1/media/${storyId}/info/`, {
            headers: { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest" },
            credentials: "include"
          });
          if (res.ok) data = await res.json();
        } catch (e) {}

        if (!data) {
          data = await new Promise((resolve) => {
            safeSendMessage({ action: "fetch_media", mediaId: storyId }, (res) => {
              resolve(res?.success && res?.data ? res.data : null);
            });
          });
        }

        const item = data?.items?.[0];
        if (item) {
          const isItemVideo = item.media_type === 2 || (item.video_versions && item.video_versions.length > 0);
          if (isVideo && isItemVideo && item.video_versions?.length > 0) {
            finalUrl = item.video_versions[0].url;
          } else if (!isVideo && !isItemVideo && item.image_versions2?.candidates?.length > 0) {
            finalUrl = pickBestCandidate(item.image_versions2.candidates);
          }
        }
      } catch (e) {}
    }

    // Fallback to active story's direct DOM URL
    if (!finalUrl) {
      finalUrl = storyMedia.url;
    }

    // Handle Picture-in-Picture for video story
    if (isVideo && videoAction === "pip" && storyMedia.element && storyMedia.element.tagName === "VIDEO") {
      if (document.pictureInPictureEnabled) {
        try {
          if (document.pictureInPictureElement === storyMedia.element) {
            await document.exitPictureInPicture();
            notify("Exited Picture-in-Picture");
          } else {
            await storyMedia.element.requestPictureInPicture();
            notify("Popped out video into Picture-in-Picture!");
          }
          return;
        } catch (pipErr) {}
      }
    }

    if (!finalUrl) {
      notify("No photo or video found in this story", true);
      return;
    }

    openMediaUrl(finalUrl, isVideo ? "video" : "photo");
  }

  /**
   * Find the active story in the center of the screen
   */
  function getActiveStoryMedia() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // 1. Direct hover if hovering over media element
    let hoveredEl = null;
    if (mouseX || mouseY) {
      hoveredEl = document.elementFromPoint(mouseX, mouseY);
      if (hoveredEl) {
        if (hoveredEl.tagName === "VIDEO" && (hoveredEl.src || hoveredEl.currentSrc)) {
          return { type: "video", url: hoveredEl.currentSrc || hoveredEl.src, element: hoveredEl };
        }
        if (hoveredEl.tagName === "IMG" && isValidStoryImage(hoveredEl)) {
          return { type: "photo", url: getDomHighestRes(hoveredEl), element: hoveredEl };
        }
      }
    }

    // 2. Identify candidate videos and images centered on screen
    // Preloaded adjacent stories are translated to the left or right, so they will NOT intersect the center
    const videos = Array.from(document.querySelectorAll("video")).filter(v => {
      const r = v.getBoundingClientRect();
      if (r.width < 120 || r.height < 200) return false;
      return r.left <= centerX && r.right >= centerX && r.top <= centerY && r.bottom >= centerY;
    });

    const images = Array.from(document.querySelectorAll("img")).filter(img => {
      if (!isValidStoryImage(img)) return false;
      const r = img.getBoundingClientRect();
      if (r.width < 120 || r.height < 200) return false;
      return r.left <= centerX && r.right >= centerX && r.top <= centerY && r.bottom >= centerY;
    });

    const getCenterDist = (el) => {
      const r = el.getBoundingClientRect();
      const midX = r.left + r.width / 2;
      const midY = r.top + r.height / 2;
      return Math.hypot(midX - centerX, midY - centerY);
    };

    // If an active playing/ready video is centered on screen, prioritize it
    const activeVideo = videos.find(v => !v.paused || v.currentTime > 0 || v.readyState >= 2);
    if (activeVideo) {
      return { type: "video", url: activeVideo.currentSrc || activeVideo.src, element: activeVideo };
    }

    // Combine centered candidates and pick the one closest to viewport center
    const allCandidates = [
      ...videos.map(v => ({ type: "video", el: v, url: v.currentSrc || v.src, dist: getCenterDist(v) })),
      ...images.map(img => ({ type: "photo", el: img, url: getDomHighestRes(img), dist: getCenterDist(img) }))
    ];

    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => a.dist - b.dist);
      const best = allCandidates[0];
      return { type: best.type, url: best.url, element: best.el };
    }

    return null;
  }

  function isValidStoryImage(img) {
    if (!img) return false;
    const w = img.offsetWidth || img.naturalWidth || 0;
    const h = img.offsetHeight || img.naturalHeight || 0;
    if ((w > 0 && w < 120) || (h > 0 && h < 180)) return false;
    const alt = (img.getAttribute("alt") || "").toLowerCase();
    if (alt.includes("profile picture") || alt.includes("profile photo")) return false;
    return true;
  }

  /* ==========================================================================
     INSTAGRAM FEED & POST TARGETING
     ========================================================================== */

  function findPostContainer(el) {
    if (!el) return null;
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr.tagName === "ARTICLE" || curr.getAttribute("role") === "dialog") {
        return curr;
      }
      if (curr.querySelector && curr.querySelector("a[href*='/p/'], a[href*='/reel/']")) {
        const r = curr.getBoundingClientRect();
        if (r.width > 250 && r.height > 200 && r.width < 1200) {
          return curr;
        }
      }
      curr = curr.parentElement;
    }
    return el.closest("article, div[role='dialog']");
  }

  function findInstagramTargetInfo() {
    let container = null;
    let hoveredEl = null;

    if (mouseX || mouseY) {
      hoveredEl = document.elementFromPoint(mouseX, mouseY);
      if (hoveredEl) {
        container = findPostContainer(hoveredEl);
      }
    }

    // If modal dialog is open, prioritize it
    if (!container) {
      container = document.querySelector("div[role='dialog'] article, div[role='dialog']");
    }

    // If on standalone page /p/ or /reel/, find main post
    if (!container && /\/(p|reel|reels|tv)\//.test(location.pathname)) {
      container = document.querySelector("main article, article");
    }

    // If on home feed, find the post/article closest to the vertical center of the viewport
    if (!container) {
      let articles = Array.from(document.querySelectorAll("article"));
      if (articles.length === 0) {
        const links = Array.from(document.querySelectorAll("a[href*='/p/'], a[href*='/reel/']"));
        articles = links.map(l => findPostContainer(l)).filter(Boolean);
      }

      const viewportMidY = window.innerHeight / 2;
      let minDiff = Infinity;
      for (const art of articles) {
        const r = art.getBoundingClientRect();
        if (r.bottom > 80 && r.top < window.innerHeight - 80) {
          const artMidY = r.top + r.height / 2;
          const diff = Math.abs(artMidY - viewportMidY);
          if (diff < minDiff) {
            minDiff = diff;
            container = art;
          }
        }
      }
    }

    // Get shortcode strictly from container or page URL
    const shortcode = getShortcodeStrict(container);

    // Carousel slide detection strictly in container
    let activeSlide = null;
    let slideIndex = 0;
    let hasExplicitIndex = false;

    if (container) {
      // 1. Check URL parameter img_index first (e.g. ?img_index=6)
      const params = new URLSearchParams(location.search);
      const urlIdx = params.get("img_index");
      if (urlIdx && !isNaN(parseInt(urlIdx, 10)) && parseInt(urlIdx, 10) >= 1) {
        slideIndex = parseInt(urlIdx, 10) - 1;
        hasExplicitIndex = true;
      }

      // 2. If no URL param, check for on-screen carousel counter badge (e.g. "6/10")
      if (!hasExplicitIndex) {
        const badgeIdx = getCarouselIndexFromDom(container);
        if (badgeIdx >= 0) {
          slideIndex = badgeIdx;
          hasExplicitIndex = true;
        }
      }

      // 3. Detect physically active/centered slide in the DOM
      // (Instagram virtualizes carousel items into 2-3 slides, so NEVER index into `slides` with global `slideIndex`!)
      const slides = Array.from(container.querySelectorAll("ul li"));
      if (slides.length > 0) {
        if (hoveredEl) {
          const hoveredSlide = hoveredEl.closest("ul li");
          if (hoveredSlide && container.contains(hoveredSlide)) {
            activeSlide = hoveredSlide;
          }
        }

        if (!activeSlide) {
          const cRect = container.getBoundingClientRect();
          const midX = cRect.left + cRect.width / 2;
          let minDiff = Infinity;
          slides.forEach((s) => {
            const r = s.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              const diff = Math.abs((r.left + r.width / 2) - midX);
              if (diff < minDiff) {
                minDiff = diff;
                activeSlide = s;
              }
            }
          });
        }
      }
    }

    // Active media element (strictly slide or container - never global document)
    const mediaScope = activeSlide || container;
    if (!mediaScope) {
      return { container: null, domUrl: null, currentSrc: "", domVideo: null, isVideoContext: false, shortcode: null, slideIndex: 0, hasExplicitIndex: false };
    }

    const domVideo = (hoveredEl && (hoveredEl.tagName === "VIDEO" ? hoveredEl : hoveredEl.closest("video"))) ||
                     mediaScope.querySelector("video");
    const isReelPage = /\/(reel|reels)\//.test(location.pathname);
    const isVideoContext = isReelPage || !!domVideo;

    let img = null;
    if (hoveredEl && hoveredEl.tagName === "IMG" && isValidPostImage(hoveredEl)) {
      img = hoveredEl;
    } else {
      const imgs = Array.from(mediaScope.querySelectorAll("img")).filter(isValidPostImage);
      if (imgs.length > 0) {
        imgs.sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight));
        img = imgs[0];
      }
    }

    const currentSrc = (domVideo && (domVideo.src || domVideo.currentSrc || domVideo.poster)) || (img ? (img.currentSrc || img.src || "") : "");
    const domUrl = img ? getDomHighestRes(img) : (domVideo?.poster || null);

    return { container, domUrl, currentSrc, domVideo, isVideoContext, shortcode, slideIndex, hasExplicitIndex };
  }

  function getCarouselIndexFromDom(container) {
    if (!container) return -1;
    const elements = Array.from(container.querySelectorAll("div, span"));
    for (const el of elements) {
      if (el.children.length === 0) {
        const text = (el.textContent || "").trim();
        const m = text.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (m) {
          const cur = parseInt(m[1], 10);
          const total = parseInt(m[2], 10);
          if (cur >= 1 && cur <= total && total <= 50) {
            return cur - 1;
          }
        }
      }
    }
    return -1;
  }

  /**
   * Extract shortcode strictly from page URL or within the container (no global fallback)
   */
  function getShortcodeStrict(container) {
    const pageMatch = location.pathname.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (pageMatch) return pageMatch[2];

    if (container) {
      const link = container.querySelector("a[href*='/p/'], a[href*='/reel/'], a[href*='/tv/']");
      if (link) {
        const m = (link.getAttribute("href") || "").match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
        if (m) return m[2];
      }
    }

    return null;
  }

  function isValidPostImage(img) {
    if (!img) return false;
    const w = img.offsetWidth || img.naturalWidth || 0;
    const h = img.offsetHeight || img.naturalHeight || 0;
    if ((w > 0 && w < 160) || (h > 0 && h < 160)) return false;
    const alt = (img.getAttribute("alt") || "").toLowerCase();
    return !alt.includes("profile picture") && !alt.includes("profile photo");
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

  function pickBestVideo(versions) {
    if (!versions || versions.length === 0) return null;
    const sorted = [...versions].sort((a, b) => {
      const sizeA = (a.width || 0) * (a.height || 0) || 0;
      const sizeB = (b.width || 0) * (b.height || 0) || 0;
      return sizeB - sizeA;
    });
    return sorted[0]?.url || null;
  }

  async function fetchMediaFromApi(shortcode, slideIndex, currentSrc, isVideoContext, hasExplicitIndex) {
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

      // Carousel post
      if (item.carousel_media && item.carousel_media.length > 0) {
        let slide = null;

        // 1. Authoritative explicit index from URL or on-screen counter badge
        if (hasExplicitIndex && slideIndex >= 0 && slideIndex < item.carousel_media.length) {
          slide = item.carousel_media[slideIndex];
        }

        // 2. Filename matching from currentSrc
        if (!slide && currentSrc) {
          const fnMatch = currentSrc.match(/\/([^\/?#]+\.(?:jpg|jpeg|png|webp|mp4))/i);
          const fileName = fnMatch ? fnMatch[1] : null;
          if (fileName) {
            slide = item.carousel_media.find(m =>
              m.image_versions2?.candidates?.some(c => c.url.includes(fileName)) ||
              m.video_versions?.some(v => v.url.includes(fileName))
            );
          }
        }

        // 3. Fallback to slideIndex or first slide
        if (!slide) {
          slide = item.carousel_media[slideIndex] || item.carousel_media[0];
        }

        const isSlideVideo = slide.media_type === 2 || (slide.video_versions && slide.video_versions.length > 0);
        if (isSlideVideo) {
          const videoUrl = pickBestVideo(slide.video_versions);
          if (videoUrl) {
            return { url: videoUrl, type: "video" };
          }
        }

        return {
          url: pickBestCandidate(slide.image_versions2?.candidates) || pickBestVideo(slide.video_versions) || null,
          type: isSlideVideo ? "video" : "photo"
        };
      }

      // Single photo or video post
      const isItemVideo = item.media_type === 2 || (item.video_versions && item.video_versions.length > 0);
      if (isItemVideo) {
        const videoUrl = pickBestVideo(item.video_versions);
        if (videoUrl && (isVideoContext || item.media_type === 2)) {
          return { url: videoUrl, type: "video" };
        }
      }

      return {
        url: pickBestCandidate(item.image_versions2?.candidates) || pickBestVideo(item.video_versions) || null,
        type: isItemVideo ? "video" : "photo"
      };
    } catch (e) {
      return null;
    }
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
