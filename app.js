(() => {
  // ── Constants ──────────────────────────────────────────────────────────
  const MAX_SCALE = 20;

  // ── State ──────────────────────────────────────────────────────────────
  let sizePct = 100;
  let imgWidth = 0;
  let gap      = 4;
  let cropPct  = 100;
  /** Fraction of frame height: shifts the left image down (positive). */
  let yRelStereo = 0;
  /** Fraction of visible frame width: shifts the left image right (positive). */
  let xRelStereo = 0;

  let imgScale = 1;
  let ltx = 0, lty = 0;
  let rtx = 0, rty = 0;

  let rowX = 0, rowY = 0;

  let dragging   = false;
  let dragStartX = 0, dragStartY = 0;
  let ltxStart   = 0, ltyStart  = 0;

  let zoomTimer = null;

  // ── Elements ───────────────────────────────────────────────────────────
  const viewer     = document.getElementById('viewer');
  const row        = document.getElementById('row');
  const frameLeft  = document.getElementById('frame-left');
  const frameRight = document.getElementById('frame-right');
  const imgLeft    = document.getElementById('img-left');
  const imgRight   = document.getElementById('img-right');
  const frameGap   = document.getElementById('frame-gap');
  const hint       = document.getElementById('hint');
  const zoomBadge  = document.getElementById('zoom-badge');
  const crossLeft  = document.getElementById('cross-left');
  const crossRight = document.getElementById('cross-right');

  const filePair   = document.getElementById('file-pair');

  const ctrlSize   = document.getElementById('ctrl-size');
  const valSize    = document.getElementById('val-size');
  const ctrlGap    = document.getElementById('ctrl-gap');
  const valGap     = document.getElementById('val-gap');
  const ctrlCrop   = document.getElementById('ctrl-crop');
  const valCrop    = document.getElementById('val-crop');
  const ctrlYRel   = document.getElementById('ctrl-yrel');
  const valYRel    = document.getElementById('val-yrel');
  const ctrlXRel   = document.getElementById('ctrl-xrel');
  const valXRel    = document.getElementById('val-xrel');

  const btnSwap   = document.getElementById('btn-swap');
  const btnFit    = document.getElementById('btn-fit');
  const btnSave       = document.getElementById('btn-save');
  const btnUpdateApp  = document.getElementById('btn-update-app');
  const selectExample    = document.getElementById('select-example');
  const sidebar          = document.getElementById('sidebar');
  const btnSidebarToggle = document.getElementById('sidebar-toggle');

  ctrlSize.value = sizePct;
  valSize.textContent = sizePct + '%';
  valXRel.textContent = formatRelOffset(xRelStereo);
  valYRel.textContent = formatRelOffset(yRelStereo);

  // ── Helpers ────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function maxFitWidth() {
    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    const byWidth = (vw - gap) / 2 / (cropPct / 100);
    let byHeight = Infinity;
    if (imgLeft.naturalWidth)  byHeight = Math.min(byHeight, vh * imgLeft.naturalWidth  / imgLeft.naturalHeight);
    if (imgRight.naturalWidth) byHeight = Math.min(byHeight, vh * imgRight.naturalWidth / imgRight.naturalHeight);
    return Math.floor(Math.min(byWidth, byHeight === Infinity ? byWidth : byHeight));
  }

  function updateImgWidth() {
    imgWidth = Math.round(sizePct / 100 * maxFitWidth());
  }

  function frameHeight() {
    const lh = imgLeft.naturalWidth
      ? Math.round((imgWidth / imgLeft.naturalWidth) * imgLeft.naturalHeight)
      : null;
    const rh = imgRight.naturalWidth
      ? Math.round((imgWidth / imgRight.naturalWidth) * imgRight.naturalHeight)
      : null;
    if (lh && rh) return Math.max(lh, rh);
    return lh || rh || Math.round(imgWidth * 0.75);
  }

  function frameHeightForBaseWidth(W) {
    const lh = imgLeft.naturalWidth
      ? Math.round((W / imgLeft.naturalWidth) * imgLeft.naturalHeight)
      : null;
    const rh = imgRight.naturalWidth
      ? Math.round((W / imgRight.naturalWidth) * imgRight.naturalHeight)
      : null;
    if (lh && rh) return Math.max(lh, rh);
    return lh || rh || Math.round(W * 0.75);
  }

  // Visible frame width after cropping
  function visibleWidth() { return Math.round(imgWidth * cropPct / 100); }
  // X offset to centre the full image inside the cropped frame
  function cropOffsetX()  { return (visibleWidth() - imgWidth) / 2; }

  /** Extra vertical pan applied to the left eye only, in pixels (see yRelStereo). */
  function stereoYShiftPx() {
    return yRelStereo * frameHeight();
  }

  /** Extra horizontal pan applied to the left eye only, in pixels (see xRelStereo). */
  function stereoXShiftPx() {
    return xRelStereo * visibleWidth();
  }

  function formatRelOffset(v) {
    const s = v.toFixed(3);
    if (v > 0) return '+' + s;
    return s;
  }

  /** Unscaled pixel height of each image at current imgWidth */
  function leftImageHeight() {
    if (!imgLeft.naturalWidth) return 0;
    return (imgWidth / imgLeft.naturalWidth) * imgLeft.naturalHeight;
  }
  function rightImageHeight() {
    if (!imgRight.naturalWidth) return 0;
    return (imgWidth / imgRight.naturalWidth) * imgRight.naturalHeight;
  }

  /** Smallest scale where the image still covers the frame (no empty margin). */
  function minScale() {
    if (!imgLeft.naturalWidth || !imgRight.naturalWidth || imgWidth <= 0) return 0.25;
    const fw = visibleWidth();
    const fh = frameHeight();
    const lh = leftImageHeight();
    const rh = rightImageHeight();
    const hMax = Math.max(lh, rh) || fh;
    const sx = fw / imgWidth;
    const sy = fh / hMax;
    return Math.max(sx, sy, 0.02);
  }

  /**
   * Keep pan/zoom inside the image edges (no empty beyond the photo inside each frame).
   * Both images share ltx/lty; vertical clamp uses the taller image so both stay aligned.
   */
  function clampPan() {
    if (!imgLeft.naturalWidth || !imgRight.naturalWidth || imgWidth <= 0) return;

    imgScale = clamp(imgScale, minScale(), MAX_SCALE);

    const fw = visibleWidth();
    const fh = frameHeight();
    const ox = cropOffsetX();
    const iw = imgWidth * imgScale;

    const lh = leftImageHeight();
    const rh = rightImageHeight();
    const hMax = Math.max(lh, rh) || fh;
    const hScaled = hMax * imgScale;

    // Horizontal: scaled width must cover [0, fw]
    if (iw >= fw) {
      const minL = fw - ox - iw;
      const maxL = -ox;
      ltx = clamp(ltx, minL, maxL);
    } else {
      ltx = (fw - iw) / 2 - ox;
    }

    // Vertical: use taller image height so pan limits match the shared frame height
    if (hScaled >= fh) {
      const minT = fh - hScaled;
      const maxT = 0;
      lty = clamp(lty, minT, maxT);
    } else {
      lty = (fh - hScaled) / 2;
    }

    rtx = ltx;
    rty = lty;
  }

  // ── Transforms ─────────────────────────────────────────────────────────
  function applyImageTransforms() {
    const ox = cropOffsetX();
    const sx = stereoXShiftPx();
    const sy = stereoYShiftPx();
    imgLeft.style.transform  = `translate(${ltx + ox + sx}px, ${lty + sy}px) scale(${imgScale})`;
    imgRight.style.transform = `translate(${rtx + ox}px, ${lty}px) scale(${imgScale})`;
  }

  function applyRowTransform() {
    row.style.transform = `translate(${rowX}px, ${rowY}px)`;
  }

  // ── Layout ─────────────────────────────────────────────────────────────
  function applyLayout() {
    const fh = frameHeight();
    const fw = visibleWidth();
    frameLeft.style.width   = fw + 'px';
    frameLeft.style.height  = fh + 'px';
    frameRight.style.width  = fw + 'px';
    frameRight.style.height = fh + 'px';
    imgLeft.style.width   = imgWidth + 'px';
    imgLeft.style.height  = 'auto';
    imgRight.style.width  = imgWidth + 'px';
    imgRight.style.height = 'auto';
    frameGap.style.width  = gap + 'px';
  }

  function centerRow() {
    const vw = viewer.clientWidth;
    const vh = viewer.clientHeight;
    rowX = (vw - visibleWidth() * 2 - gap) / 2;
    rowY = (vh - frameHeight()) / 2;
    applyRowTransform();
  }

  function resetImagePan() {
    ltx = 0; lty = 0;
    rtx = 0; rty = 0;
    clampPan();
    applyImageTransforms();
  }

  function resetImageZoom() {
    imgScale = 1;
    resetImagePan();
  }

  // ── File loading ───────────────────────────────────────────────────────
  let leftLoaded = false, rightLoaded = false;

  // FileReader-based loader — more reliable than createObjectURL on Android
  // (avoids issues with cloud-backed files and browser URL revocation)
  function loadFileObj(file, imgEl, side) {
    const reader = new FileReader();
    reader.onload = e => {
      imgEl.onload = () => {
        if (side === 'left')  leftLoaded  = true;
        if (side === 'right') rightLoaded = true;
        hint.classList.add('hidden');
        updateImgWidth();
        applyLayout();
        centerRow();
        resetImageZoom();
      };
      imgEl.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  filePair.addEventListener('change', () => {
    const files = Array.from(filePair.files).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length < 2) {
      alert('Choose two images.');
      return;
    }
    loadFileObj(files[0], imgLeft,  'left');
    loadFileObj(files[1], imgRight, 'right');
  });

  // ── Example loader ─────────────────────────────────────────────────────
  function loadFromUrl(url, imgEl, side) {
    imgEl.onload = () => {
      if (side === 'left')  leftLoaded  = true;
      if (side === 'right') rightLoaded = true;
      hint.classList.add('hidden');
      updateImgWidth();
      applyLayout();
      centerRow();
      resetImageZoom();
    };
    imgEl.src = url;
  }

  selectExample.addEventListener('change', () => {
    const val = selectExample.value;
    if (!val) return;
    leftLoaded  = false;
    rightLoaded = false;
    loadFromUrl(`examples/${val}/left.jpg`,  imgLeft,  'left');
    loadFromUrl(`examples/${val}/right.jpg`, imgRight, 'right');
    selectExample.value = '';
  });

  // ── Controls ───────────────────────────────────────────────────────────
  ctrlSize.addEventListener('input', () => {
    sizePct = +ctrlSize.value;
    valSize.textContent = sizePct + '%';
    updateImgWidth();
    applyLayout();
    centerRow();
    resetImageZoom();
  });

  ctrlGap.addEventListener('input', () => {
    gap = +ctrlGap.value;
    valGap.textContent = gap + ' px';
    applyLayout();
    centerRow();
    clampPan();
    applyImageTransforms();
  });

  ctrlCrop.addEventListener('input', () => {
    cropPct = +ctrlCrop.value;
    valCrop.textContent = cropPct + '%';
    updateImgWidth();
    applyLayout();
    centerRow();
    clampPan();
    applyImageTransforms();
  });

  ctrlXRel.addEventListener('input', () => {
    xRelStereo = +ctrlXRel.value;
    valXRel.textContent = formatRelOffset(xRelStereo);
    applyImageTransforms();
  });

  ctrlYRel.addEventListener('input', () => {
    yRelStereo = +ctrlYRel.value;
    valYRel.textContent = formatRelOffset(yRelStereo);
    applyImageTransforms();
  });

  btnFit.addEventListener('click', () => {
    sizePct = 100;
    ctrlSize.value = 100;
    valSize.textContent = '100%';
    updateImgWidth();
    applyLayout();
    centerRow();
    resetImageZoom();
  });

  btnSwap.addEventListener('click', () => {
    const leftSrc  = imgLeft.src;
    const rightSrc = imgRight.src;
    imgLeft.src  = rightSrc;
    imgRight.src = leftSrc;
    resetImagePan();
  });

  /** Export draw: same framing as on-screen but at base layout width W (dh matches aspect). */
  function drawExportedFrameAt(ctx, imgEl, frameX, frameY, fw, fh, W, ox, panX, panY, scale) {
    const dh = (W / imgEl.naturalWidth) * imgEl.naturalHeight;
    ctx.save();
    ctx.translate(frameX, frameY);
    ctx.beginPath();
    ctx.rect(0, 0, fw, fh);
    ctx.clip();
    ctx.translate(panX + ox, panY);
    ctx.scale(scale, scale);
    ctx.drawImage(imgEl, 0, 0, W, dh);
    ctx.restore();
  }

  async function exportStereoPng() {
    if (!imgLeft.naturalWidth || !imgRight.naturalWidth) {
      alert('Load a pair of images first.');
      return;
    }
    if (!imgWidth) {
      alert('Nothing to export yet.');
      return;
    }
    try {
      await Promise.all([
        imgLeft.decode?.() ?? Promise.resolve(),
        imgRight.decode?.() ?? Promise.resolve(),
      ]);
    } catch (_) { /* decode optional */ }

    // Full "fit" width (100% Size): slider does not change export resolution.
    const Wp = Math.round(maxFitWidth());
    const ratio = Wp / imgWidth;
    const fwP = Math.round(Wp * cropPct / 100);
    const fhP = frameHeightForBaseWidth(Wp);
    const oxP = (fwP - Wp) / 2;
    const gapP = Math.round(gap * ratio);
    // Pan & frame size scale by ratio; zoom is unchanged (same fraction of layout width visible).
    const scaleP = imgScale;
    const ltxP = ltx * ratio;
    const ltyP = lty * ratio;
    const stereoXExport = xRelStereo * fwP;
    const stereoYExport = yRelStereo * fhP;
    const ltxPLeft = ltxP + stereoXExport;
    const ltyPLeft = ltyP + stereoYExport;

    const outW = Math.round(2 * fwP + gapP);
    const outH = fhP;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, Math.round(outW * dpr));
    canvas.height = Math.max(1, Math.round(outH * dpr));
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0f0f11';
    ctx.fillRect(0, 0, outW, outH);

    drawExportedFrameAt(ctx, imgLeft, 0, 0, fwP, fhP, Wp, oxP, ltxPLeft, ltyPLeft, scaleP);
    drawExportedFrameAt(ctx, imgRight, fwP + gapP, 0, fwP, fhP, Wp, oxP, ltxP, ltyP, scaleP);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stereogram-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  btnSave.addEventListener('click', () => { exportStereoPng(); });

  // ── Zoom (scroll wheel) ────────────────────────────────────────────────
  viewer.addEventListener('wheel', (e) => {
    e.preventDefault();

    const leftRect  = frameLeft.getBoundingClientRect();
    const rightRect = frameRight.getBoundingClientRect();

    const cx_l = e.clientX - leftRect.left;
    const cy_l = e.clientY - leftRect.top;
    const cx_r = e.clientX - rightRect.left;
    const cy_r = e.clientY - rightRect.top;

    const overLeft  = cx_l >= 0 && cx_l <= leftRect.width  && cy_l >= 0 && cy_l <= leftRect.height;
    const overRight = cx_r >= 0 && cx_r <= rightRect.width && cy_r >= 0 && cy_r <= rightRect.height;

    let cx, cy;
    if (overLeft)       { cx = cx_l; cy = cy_l; }
    else if (overRight) { cx = cx_r; cy = cy_r; }
    else                { cx = leftRect.width / 2; cy = leftRect.height / 2; }

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale   = clamp(imgScale * zoomFactor, minScale(), MAX_SCALE);

    const ox   = cropOffsetX();
    const imgX = (cx - (ltx + ox)) / imgScale;
    const imgY = (cy - lty) / imgScale;

    imgScale = newScale;
    ltx = cx - imgX * newScale - ox;
    lty = cy - imgY * newScale;
    rtx = ltx; rty = lty;

    clampPan();
    applyImageTransforms();
    showZoomBadge();
  }, { passive: false });

  // ── Pan (drag within both frames) ─────────────────────────────────────
  viewer.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging   = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    ltxStart   = ltx;
    ltyStart   = lty;
    viewer.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    ltx = ltxStart + (e.clientX - dragStartX);
    lty = ltyStart + (e.clientY - dragStartY);
    rtx = ltx; rty = lty;
    clampPan();
    applyImageTransforms();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    viewer.classList.remove('dragging');
  });

  // ── Touch support ──────────────────────────────────────────────────────
  /** Snapshot touches — TouchList is not safe to keep after the event returns. */
  function touchSnapshot(touches) {
    if (!touches || touches.length === 0) return null;
    return Array.from(touches).map((t) => ({ clientX: t.clientX, clientY: t.clientY }));
  }

  function seedSingleTouchPan(touch) {
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    ltxStart   = ltx;
    ltyStart   = lty;
  }

  let lastTouches = null;

  viewer.addEventListener('touchstart', (e) => {
    lastTouches = touchSnapshot(e.touches);
    if (e.touches.length === 1) seedSingleTouchPan(e.touches[0]);
  }, { passive: true });

  viewer.addEventListener('touchmove', (e) => {
    e.preventDefault();

    // After pinch, one finger remains but we never got touchstart for it — old dragStart would jump the image.
    if (e.touches.length === 1 && lastTouches?.length === 2) {
      seedSingleTouchPan(e.touches[0]);
    }

    if (e.touches.length === 1 && lastTouches?.length === 1) {
      ltx = ltxStart + (e.touches[0].clientX - dragStartX);
      lty = ltyStart + (e.touches[0].clientY - dragStartY);
      rtx = ltx; rty = lty;
      clampPan();
      applyImageTransforms();
    } else if (e.touches.length === 2 && lastTouches?.length >= 2) {
      const prev     = lastTouches;
      const prevDist = Math.hypot(prev[0].clientX - prev[1].clientX, prev[0].clientY - prev[1].clientY);
      const newDist  = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const leftRect   = frameLeft.getBoundingClientRect();
      const cx         = midX - leftRect.left;
      const cy         = midY - leftRect.top;
      const zoomFactor = prevDist > 1e-6 ? newDist / prevDist : 1;
      const newScale   = clamp(imgScale * zoomFactor, minScale(), MAX_SCALE);
      const ox   = cropOffsetX();
      const imgX = (cx - (ltx + ox)) / imgScale;
      const imgY = (cy - lty) / imgScale;
      imgScale = newScale;
      ltx = cx - imgX * newScale - ox;
      lty = cy - imgY * newScale;
      rtx = ltx; rty = lty;
      clampPan();
      applyImageTransforms();
      showZoomBadge();
    }
    lastTouches = touchSnapshot(e.touches);
  }, { passive: false });

  function onTouchEndOrCancel(e) {
    lastTouches = touchSnapshot(e.touches);
    if (e.touches.length === 1) seedSingleTouchPan(e.touches[0]);
  }

  viewer.addEventListener('touchend', onTouchEndOrCancel, { passive: true });
  viewer.addEventListener('touchcancel', onTouchEndOrCancel, { passive: true });

  // ── Zoom badge ─────────────────────────────────────────────────────────
  function showZoomBadge() {
    zoomBadge.textContent = Math.round(imgScale * 100) + '%';
    zoomBadge.classList.add('visible');
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => zoomBadge.classList.remove('visible'), 1200);
  }

  // ── Crosshair ──────────────────────────────────────────────────────────
  function placeCrosshairs(cx, cy) {
    crossLeft.style.left  = cx + 'px';
    crossLeft.style.top   = cy + 'px';
    crossRight.style.left = cx + 'px';
    crossRight.style.top  = cy + 'px';
    crossLeft.classList.add('visible');
    crossRight.classList.add('visible');
  }

  viewer.addEventListener('mousemove', (e) => {
    const leftRect  = frameLeft.getBoundingClientRect();
    const rightRect = frameRight.getBoundingClientRect();
    const overLeft  = e.clientX >= leftRect.left  && e.clientX <= leftRect.right  && e.clientY >= leftRect.top && e.clientY <= leftRect.bottom;
    const overRight = e.clientX >= rightRect.left && e.clientX <= rightRect.right && e.clientY >= rightRect.top && e.clientY <= rightRect.bottom;

    if (overLeft) {
      placeCrosshairs(e.clientX - leftRect.left, e.clientY - leftRect.top);
    } else if (overRight) {
      placeCrosshairs(e.clientX - rightRect.left, e.clientY - rightRect.top);
    } else {
      crossLeft.classList.remove('visible');
      crossRight.classList.remove('visible');
    }
  });

  viewer.addEventListener('mouseleave', () => {
    crossLeft.classList.remove('visible');
    crossRight.classList.remove('visible');
  });

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      sizePct = clamp(sizePct + (e.key === 'ArrowRight' ? 2 : -2), 10, 100);
      ctrlSize.value = sizePct;
      valSize.textContent = sizePct + '%';
      updateImgWidth();
      applyLayout();
      centerRow();
      resetImageZoom();
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const zoomFactor = e.key === 'ArrowUp' ? 1.1 : 1 / 1.1;
      const newScale   = clamp(imgScale * zoomFactor, minScale(), MAX_SCALE);
      const cx = frameLeft.clientWidth  / 2;
      const cy = frameLeft.clientHeight / 2;
      const ox   = cropOffsetX();
      const imgX = (cx - (ltx + ox)) / imgScale;
      const imgY = (cy - lty) / imgScale;
      imgScale = newScale;
      ltx = cx - imgX * newScale - ox;
      lty = cy - imgY * newScale;
      rtx = ltx; rty = lty;
      clampPan();
      applyImageTransforms();
      showZoomBadge();
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────
  updateImgWidth();
  applyLayout();
  centerRow();
  clampPan();
  applyImageTransforms();

  window.addEventListener('resize', () => {
    updateImgWidth();
    applyLayout();
    centerRow();
    clampPan();
    applyImageTransforms();
  });

  /** Drop SW + Cache Storage, then reload (reliable fresh fetch for cache-first PWA). */
  async function reloadAppFromNetwork() {
    if (btnUpdateApp.disabled) return;
    btnUpdateApp.disabled = true;
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) {
      btnUpdateApp.disabled = false;
      return;
    }
    window.location.reload();
  }

  btnUpdateApp.addEventListener('click', () => { reloadAppFromNetwork(); });

  // ── Sidebar toggle ─────────────────────────────────────────────────────
  btnSidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    setTimeout(() => {
      updateImgWidth();
      applyLayout();
      centerRow();
      clampPan();
      applyImageTransforms();
    }, 230);
  });
})();
