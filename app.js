(() => {
  // ── Constants ──────────────────────────────────────────────────────────
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 20;

  // ── State ──────────────────────────────────────────────────────────────
  let sizePct  = 50;
  let imgWidth = 0;
  let gap      = 4;
  let cropPct  = 100;

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

  const fileLeft   = document.getElementById('file-left');
  const fileRight  = document.getElementById('file-right');
  const nameLeft   = document.getElementById('name-left');
  const nameRight  = document.getElementById('name-right');

  const ctrlSize   = document.getElementById('ctrl-size');
  const valSize    = document.getElementById('val-size');
  const ctrlGap    = document.getElementById('ctrl-gap');
  const valGap     = document.getElementById('val-gap');
  const ctrlCrop   = document.getElementById('ctrl-crop');
  const valCrop    = document.getElementById('val-crop');

  const btnSwap   = document.getElementById('btn-swap');
  const btnCenter = document.getElementById('btn-center');
  const btnReset  = document.getElementById('btn-reset');
  const selectExample = document.getElementById('select-example');

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

  // Visible frame width after cropping
  function visibleWidth() { return Math.round(imgWidth * cropPct / 100); }
  // X offset to centre the full image inside the cropped frame
  function cropOffsetX()  { return (visibleWidth() - imgWidth) / 2; }

  // ── Transforms ─────────────────────────────────────────────────────────
  function applyImageTransforms() {
    const ox = cropOffsetX();
    imgLeft.style.transform  = `translate(${ltx + ox}px, ${lty}px) scale(${imgScale})`;
    imgRight.style.transform = `translate(${rtx + ox}px, ${rty}px) scale(${imgScale})`;
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
    applyImageTransforms();
  }

  function resetImageZoom() {
    imgScale = 1;
    resetImagePan();
  }

  // ── File loading ───────────────────────────────────────────────────────
  let leftLoaded = false, rightLoaded = false;

  function loadFile(input, imgEl, nameEl, side) {
    const file = input.files[0];
    if (!file) return;
    nameEl.textContent = file.name;
    nameEl.classList.add('loaded');
    const url = URL.createObjectURL(file);
    imgEl.onload = () => {
      if (side === 'left')  leftLoaded  = true;
      if (side === 'right') rightLoaded = true;
      hint.classList.add('hidden');
      resetImageZoom();
      updateImgWidth();
      applyLayout();
      centerRow();
    };
    imgEl.src = url;
  }

  fileLeft.addEventListener('change',  () => loadFile(fileLeft,  imgLeft,  nameLeft,  'left'));
  fileRight.addEventListener('change', () => loadFile(fileRight, imgRight, nameRight, 'right'));

  // ── Example loader ─────────────────────────────────────────────────────
  function loadFromUrl(url, imgEl, nameEl, side) {
    const name = url.split('/').slice(-2).join('/');
    nameEl.textContent = name;
    nameEl.classList.add('loaded');
    imgEl.onload = () => {
      if (side === 'left')  leftLoaded  = true;
      if (side === 'right') rightLoaded = true;
      hint.classList.add('hidden');
      resetImageZoom();
      updateImgWidth();
      applyLayout();
      centerRow();
    };
    imgEl.src = url;
  }

  selectExample.addEventListener('change', () => {
    const val = selectExample.value;
    if (!val) return;
    leftLoaded  = false;
    rightLoaded = false;
    loadFromUrl(`examples/${val}/left.svg`,  imgLeft,  nameLeft,  'left');
    loadFromUrl(`examples/${val}/right.svg`, imgRight, nameRight, 'right');
    selectExample.value = '';
  });

  // ── Controls ───────────────────────────────────────────────────────────
  ctrlSize.addEventListener('input', () => {
    sizePct = +ctrlSize.value;
    valSize.textContent = sizePct + '%';
    resetImageZoom();
    updateImgWidth();
    applyLayout();
    centerRow();
  });

  ctrlGap.addEventListener('input', () => {
    gap = +ctrlGap.value;
    valGap.textContent = gap + ' px';
    applyLayout();
    centerRow();
  });

  ctrlCrop.addEventListener('input', () => {
    cropPct = +ctrlCrop.value;
    valCrop.textContent = cropPct + '%';
    updateImgWidth();
    applyLayout();
    centerRow();
    applyImageTransforms();
  });

  btnSwap.addEventListener('click', () => {
    const leftSrc   = imgLeft.src;
    const rightSrc  = imgRight.src;
    const leftName  = nameLeft.textContent;
    const rightName = nameRight.textContent;
    const leftClass  = nameLeft.className;
    const rightClass = nameRight.className;
    imgLeft.src  = rightSrc;
    imgRight.src = leftSrc;
    nameLeft.textContent  = rightName;
    nameRight.textContent = leftName;
    nameLeft.className  = rightClass;
    nameRight.className = leftClass;
    resetImagePan();
  });

  btnCenter.addEventListener('click', resetImagePan);
  btnReset.addEventListener('click', () => {
    resetImageZoom();
    showZoomBadge();
  });

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
    const newScale   = clamp(imgScale * zoomFactor, MIN_SCALE, MAX_SCALE);

    const ox   = cropOffsetX();
    const imgX = (cx - (ltx + ox)) / imgScale;
    const imgY = (cy - lty) / imgScale;

    ltx = cx - imgX * newScale - ox;
    lty = cy - imgY * newScale;
    rtx = ltx; rty = lty;

    imgScale = newScale;
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
    applyImageTransforms();
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    viewer.classList.remove('dragging');
  });

  // ── Touch support ──────────────────────────────────────────────────────
  let lastTouches = null;

  viewer.addEventListener('touchstart', (e) => {
    lastTouches = e.touches;
    if (e.touches.length === 1) {
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      ltxStart   = ltx;
      ltyStart   = lty;
    }
  }, { passive: true });

  viewer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && lastTouches?.length === 1) {
      ltx = ltxStart + (e.touches[0].clientX - dragStartX);
      lty = ltyStart + (e.touches[0].clientY - dragStartY);
      rtx = ltx; rty = lty;
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
      const zoomFactor = newDist / prevDist;
      const newScale   = clamp(imgScale * zoomFactor, MIN_SCALE, MAX_SCALE);
      const ox   = cropOffsetX();
      const imgX = (cx - (ltx + ox)) / imgScale;
      const imgY = (cy - lty) / imgScale;
      ltx = cx - imgX * newScale - ox;
      lty = cy - imgY * newScale;
      rtx = ltx; rty = lty;
      imgScale = newScale;
      applyImageTransforms();
      showZoomBadge();
    }
    lastTouches = e.touches;
  }, { passive: false });

  viewer.addEventListener('touchend', () => { lastTouches = null; });

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
      resetImageZoom();
      updateImgWidth();
      applyLayout();
      centerRow();
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const zoomFactor = e.key === 'ArrowUp' ? 1.1 : 1 / 1.1;
      const newScale   = clamp(imgScale * zoomFactor, MIN_SCALE, MAX_SCALE);
      const cx = frameLeft.clientWidth  / 2;
      const cy = frameLeft.clientHeight / 2;
      const ox   = cropOffsetX();
      const imgX = (cx - (ltx + ox)) / imgScale;
      const imgY = (cy - lty) / imgScale;
      ltx = cx - imgX * newScale - ox;
      lty = cy - imgY * newScale;
      rtx = ltx; rty = lty;
      imgScale = newScale;
      applyImageTransforms();
      showZoomBadge();
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────
  updateImgWidth();
  applyLayout();
  centerRow();
  applyImageTransforms();

  // Preload the selected example
  const preload = selectExample.value;
  if (preload) {
    leftLoaded = false; rightLoaded = false;
    loadFromUrl(`examples/${preload}/left.jpg`,  imgLeft,  nameLeft,  'left');
    loadFromUrl(`examples/${preload}/right.jpg`, imgRight, nameRight, 'right');
  }

  window.addEventListener('resize', () => { updateImgWidth(); applyLayout(); centerRow(); });
})();
