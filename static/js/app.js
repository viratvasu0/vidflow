(() => {
  "use strict";

  const els = {
    form: document.getElementById("analyzeForm"),
    urlInput: document.getElementById("urlInput"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    skeleton: document.getElementById("skeletonState"),
    empty: document.getElementById("emptyState"),
    errorCard: document.getElementById("errorState"),
    errorMessage: document.getElementById("errorMessage"),
    resultCard: document.getElementById("resultCard"),
    thumb: document.getElementById("videoThumb"),
    thumbFallback: document.getElementById("thumbFallback"),
    title: document.getElementById("videoTitle"),
    source: document.getElementById("videoSource"),
    duration: document.getElementById("videoDuration"),
    contentType: document.getElementById("videoContentType"),
    formatsGrid: document.getElementById("formatsGrid"),
    downloadBtn: document.getElementById("downloadBtn"),
    progressWrap: document.getElementById("progressWrap"),
    progressBar: document.getElementById("progressBar"),
    progressLabel: document.getElementById("progressLabel"),
    toastRegion: document.getElementById("toastRegion"),
    navToggle: document.getElementById("navToggle"),
    mainNav: document.querySelector(".main-nav"),
    year: document.getElementById("year"),
  };

  let currentUrl = null;
  let selectedFormat = null;
  let statusPollTimer = null;

  els.year.textContent = new Date().getFullYear();

  els.navToggle?.addEventListener("click", () => {
    const expanded = els.navToggle.getAttribute("aria-expanded") === "true";
    els.navToggle.setAttribute("aria-expanded", String(!expanded));
    els.mainNav.style.display = expanded ? "none" : "flex";
    els.mainNav.style.flexDirection = "column";
    els.mainNav.style.position = "absolute";
    els.mainNav.style.top = "68px";
    els.mainNav.style.right = "20px";
    els.mainNav.style.background = "rgba(10,11,18,0.95)";
    els.mainNav.style.padding = "16px 20px";
    els.mainNav.style.borderRadius = "14px";
    els.mainNav.style.border = "1px solid rgba(255,255,255,0.1)";
  });

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastRegion.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function setLoading(isLoading) {
    els.analyzeBtn.disabled = isLoading;
    els.analyzeBtn.classList.toggle("loading", isLoading);
    els.analyzeBtn.querySelector(".btn-label").textContent = isLoading ? "Analyzing" : "Analyze";
  }

  function resetStates() {
    els.skeleton.classList.add("hidden");
    els.empty.classList.add("hidden");
    els.errorCard.classList.add("hidden");
    els.resultCard.classList.add("hidden");
  }

  function showError(message) {
    resetStates();
    els.errorMessage.textContent = message;
    els.errorCard.classList.remove("hidden");
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return null;
    const units = ["B", "KB", "MB", "GB"];
    let val = bytes, i = 0;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function renderFormats(formats) {
    els.formatsGrid.innerHTML = "";
    formats.forEach((fmt, idx) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "format-card";
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-pressed", "false");
      card.dataset.formatId = fmt.id;

      const resLabel = (fmt.resolution || "").split(" ")[0] || "—";
      const tag = (fmt.resolution || "").match(/\(([^)]+)\)/);

      card.innerHTML = `
        <div class="format-res">${resLabel}</div>
        ${tag ? `<div class="format-tag">${tag[1]}</div>` : "<div class=\"format-tag\">VIDEO</div>"}
        <div class="format-label">${(fmt.format || "video").toUpperCase()}</div>
        <div class="format-details">
          ${fmt.fps ? `${fmt.fps} fps<br>` : ""}
          ${fmt.video_codec ? `${fmt.video_codec}<br>` : ""}
          ${formatBytes(fmt.filesize) ? `${formatBytes(fmt.filesize)}<br>` : ""}
          ${fmt.has_audio ? "Audio ✓" : "No audio"}
        </div>
      `;

      card.addEventListener("click", () => {
        document.querySelectorAll(".format-card").forEach((c) => {
          c.classList.remove("selected");
          c.setAttribute("aria-pressed", "false");
        });
        card.classList.add("selected");
        card.setAttribute("aria-pressed", "true");
        selectedFormat = fmt;
        els.downloadBtn.disabled = false;
        els.downloadBtn.querySelector(".btn-label").textContent = `Download ${resLabel}`;
      });

      els.formatsGrid.appendChild(card);
      if (idx === 0) card.click();
    });
  }

  function renderResult(data) {
    resetStates();
    els.resultCard.classList.remove("hidden");

    els.title.textContent = data.title || "Untitled video";
    els.source.textContent = safeHostname(data.source);
    els.duration.textContent = data.duration ? `⏱ ${data.duration}` : "Duration unknown";
    els.contentType.textContent = data.content_type || "video";

    if (data.thumbnail) {
      els.thumb.src = data.thumbnail;
      els.thumb.classList.remove("hidden");
      els.thumbFallback.classList.add("hidden");
    } else {
      els.thumb.classList.add("hidden");
      els.thumbFallback.classList.remove("hidden");
    }

    renderFormats(data.formats || []);

    els.downloadBtn.disabled = !(data.formats && data.formats.length);
    els.progressWrap.classList.add("hidden");
    els.progressBar.style.width = "0%";
  }

  function safeHostname(url) {
    try { return new URL(url).hostname; } catch { return "authorized source"; }
  }

  async function analyze(url) {
    resetStates();
    els.skeleton.classList.remove("hidden");
    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        showError(data.error || "We couldn't analyze that video. Please check the URL and try again.");
        return;
      }

      currentUrl = url;
      renderResult(data);
      showToast("Video analyzed successfully.", "success");
    } catch (err) {
      showError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = els.urlInput.value.trim();
    if (!url) {
      showToast("Please paste a video URL first.", "error");
      return;
    }
    selectedFormat = null;
    analyze(url);
  });

  const STAGE_LABELS = {
    queued: "Queued...",
    preparing: "Preparing...",
    fetching_media: "Fetching media...",
    processing: "Processing...",
    combining_streams: "Combining streams...",
    preparing_download: "Preparing download...",
    complete: "Complete",
    failed: "Failed",
  };

  function stopPolling() {
    if (statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
  }

  async function pollStatus(jobId) {
    stopPolling();
    statusPollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${encodeURIComponent(jobId)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
          stopPolling();
          showError(data.error || "Lost track of the processing job.");
          resetDownloadButton();
          return;
        }

        els.progressBar.style.width = `${data.progress || 0}%`;
        els.progressLabel.textContent = STAGE_LABELS[data.status] || data.message || "Processing...";

        if (data.status === "complete") {
          stopPolling();
          showToast("Processing complete.", "success");
          resetDownloadButton();
        } else if (data.status === "failed") {
          stopPolling();
          showError(data.error || "Processing failed.");
          resetDownloadButton();
        }
      } catch {
        stopPolling();
        showError("Network error while checking processing status.");
        resetDownloadButton();
      }
    }, 900);
  }

  function resetDownloadButton() {
    els.downloadBtn.disabled = false;
    els.downloadBtn.classList.remove("loading");
    const resLabel = selectedFormat ? (selectedFormat.resolution || "").split(" ")[0] : "";
    els.downloadBtn.querySelector(".btn-label").textContent = resLabel
      ? `Download ${resLabel}`
      : "Select a resolution";
  }

  els.downloadBtn.addEventListener("click", async () => {
    if (!currentUrl || !selectedFormat) {
      showToast("Please select a resolution first.", "error");
      return;
    }

    els.downloadBtn.disabled = true;
    els.downloadBtn.classList.add("loading");
    els.progressWrap.classList.remove("hidden");
    els.progressBar.style.width = "0%";
    els.progressLabel.textContent = "Preparing...";

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          format_id: selectedFormat.id,
          format: selectedFormat,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        showError(data.error || "Could not start processing. Please try again.");
        resetDownloadButton();
        return;
      }

      pollStatus(data.job_id);
    } catch {
      showError("Network error — could not start the download.");
      resetDownloadButton();
    }
  });
})();
