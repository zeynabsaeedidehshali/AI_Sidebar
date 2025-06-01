/* content.js ─────────────────────────────────────────────────────────────
 * Injects the sidebar iframe, supports drag‐to‐resize & collapse/expand,
 * runs a region‐capture overlay, crops the selection, then sends the PNG
 * (plus a generated name) to the sidebar.
 * ─────────────────────────────────────────────────────────────────────── */

; (function () {
  'use strict';

  /*════════════ CONFIG ════════════*/
  const FRAME_URL = chrome.runtime.getURL('sidebar.html');

  const START_W = 380;      // default expanded width
  const MIN_W   = 200;      // narrowest allowed by drag
  const GRIP_W  = 8;        // draggable strip width
  const BTN_W   = 20;       // collapse / expand button width
  const Z       = 2147483646;

  let sidebar, frame, grip, toggle;
  let width     = START_W;
  let lastW     = START_W;
  let collapsed = false;

  /*════════════ 1. SIDEBAR ════════════*/
  function injectSidebar() {
    if (sidebar) return;

    /* container */
    sidebar = document.createElement('div');
    Object.assign(sidebar.style, {
      position:        'fixed',
      top:             '0',
      right:           '0',
      width:           `${width}px`,
      height:          '100vh',
      display:         'flex',
      flexDirection:   'row',
      pointerEvents:   'none',
      zIndex:          Z,
      transition:      'width .15s ease'
    });
    document.body.appendChild(sidebar);

    /* iframe */
    frame = document.createElement('iframe');
    frame.src = FRAME_URL;
    Object.assign(frame.style, {
      border:         'none',
      width:          '100%',
      height:         '100%',
      pointerEvents:  'auto',
      background:     '#fff',
      boxShadow:      '0 0 10px rgba(0,0,0,.15)'
    });
    sidebar.appendChild(frame);

    /* draggable grip (fixed so it never slides off‐screen) */
    grip = document.createElement('div');
    Object.assign(grip.style, {
      position:      'fixed',
      top:           '0',
      right:         `${width}px`,
      width:         `${GRIP_W}px`,
      height:        '100vh',
      cursor:        'col-resize',
      zIndex:        Z + 2
    });
    document.body.appendChild(grip);

    /* collapse / expand button (moved inside sidebar, no gap) */
    toggle = document.createElement('div');
    toggle.textContent = '‹';
    Object.assign(toggle.style, {
      position:      'absolute',       // now absolute inside sidebar
      left:          `-${BTN_W}px`,    // hug the sidebar’s left edge
      top:           '50%',
      transform:     'translateY(-50%)',
      width:         `${BTN_W}px`,
      height:        '60px',
      lineHeight:    '58px',
      textAlign:     'center',
      background:    '#006ee8',
      color:         '#fff',
      fontWeight:    'bold',
      borderRadius:  '4px 0 0 4px',
      cursor:        'pointer',
      userSelect:    'none',
      zIndex:        Z + 3,
      pointerEvents: 'auto'
    });
    sidebar.appendChild(toggle);

    shiftPageRight(width);

    grip  .addEventListener('mousedown',  beginDrag);
    toggle.addEventListener('click',       toggleSidebar);
    document.addEventListener('keydown',   (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        toggleSidebar();
      }
    });
  }

  const shiftPageRight = px => {
    document.documentElement.style.marginRight = `${px}px`;
  };
  const resetPageShift = () => {
    document.documentElement.style.marginRight = '0';
  };

  /*════ 1-A. COLLAPSE / EXPAND ════*/
  function toggleSidebar() {
    if (collapsed) {                  // expand
      width = Math.max(lastW, MIN_W);
      sidebar.style.width = `${width}px`;
      frame.style.display = 'block';
      shiftPageRight(width);
      toggle.textContent = '‹';
      collapsed = false;
    } else {                          // collapse
      lastW = width;
      sidebar.style.width = '0';
      frame.style.display = 'none';
      resetPageShift();
      toggle.textContent = '›';
      collapsed = true;
    }
    alignEdgeHelpers();
  }

  /*════ 1-B. DRAG‐THEN‐RELEASE RESIZE ════*/
  let ghost, startX, startW;

  function beginDrag(e) {
    if (collapsed) return;
    frame.style.pointerEvents   = 'none';
    document.body.style.userSelect = 'none';

    startX = e.clientX;
    startW = width;

    ghost = document.createElement('div');
    Object.assign(ghost.style, {
      position:   'fixed',
      top:        '0',
      bottom:     '0',
      width:      '2px',
      background: '#2196F3',
      zIndex:     Z + 4
    });
    document.body.appendChild(ghost);
    moveGhost(e.clientX);

    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup',   endDrag);
    e.preventDefault();
  }

  const moveDrag = e => moveGhost(e.clientX);

  function moveGhost(clientX) {
    const newW = clamp(startW + (startX - clientX), MIN_W, window.innerWidth - 100);
    ghost.style.left = `${window.innerWidth - newW}px`;
  }

  function endDrag(e) {
    window.removeEventListener('mousemove', moveDrag);
    window.removeEventListener('mouseup',   endDrag);

    width = clamp(startW + (startX - e.clientX), MIN_W, window.innerWidth - 100);
    sidebar.style.width = `${width}px`;
    shiftPageRight(width);
    alignEdgeHelpers();

    ghost.remove();
    frame.style.pointerEvents   = 'auto';
    document.body.style.userSelect = '';
    ghost = null;
  }

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function alignEdgeHelpers() {
    grip.style.right  = `${collapsed ? 0 : width}px`;
    // toggle is inside sidebar, so no need to update its 'right'
  }

  /*════════════ 2. REGION CAPTURE ════════════*/
  let overlay, box, sX, sY;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'startRegionCapture') {
      startOverlay();
    }
  });

  function startOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:   'fixed',
      inset:      '0',
      cursor:     'crosshair',
      background: 'rgba(0,0,0,.1)',
      zIndex:     Z + 5
    });
    document.body.appendChild(overlay);

    box = document.createElement('div');
    Object.assign(box.style, {
      position:   'absolute',
      border:     '2px dashed #2196F3',
      background: 'rgba(33,150,243,.2)',
      pointerEvents: 'none'
    });
    overlay.appendChild(box);

    overlay.addEventListener('mousedown', oDown);
    window.addEventListener('keydown',    oEsc);
  }

  function oDown(e) {
    sX = e.clientX;
    sY = e.clientY;
    drawBox(sX, sY, 0, 0);
    overlay.addEventListener('mousemove', oMove);
    overlay.addEventListener('mouseup',   oUp);
  }

  const oMove = e => {
    const r = rect(sX, sY, e.clientX, e.clientY);
    drawBox(r.left, r.top, r.width, r.height);
  };

  const oUp = e => {
    overlay.removeEventListener('mousemove', oMove);
    overlay.removeEventListener('mouseup',   oUp);

    const r = rect(sX, sY, e.clientX, e.clientY);
    cleanupOverlay();

    chrome.runtime.sendMessage({ type: 'captureRegionRequest', rect: r }, (resp) => {
      if (!resp?.success) return console.error(resp?.error);
      cropAndSend(resp.screenshotDataUrl, r);
    });
  };

  const oEsc = e => {
    if (e.key === 'Escape') cleanupOverlay();
  };

  function cleanupOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = box = null;
    window.removeEventListener('keydown', oEsc);
  }

  function drawBox(left, top, width, height) {
    Object.assign(box.style, {
      left:   `${left}px`,
      top:    `${top}px`,
      width:  `${width}px`,
      height: `${height}px`
    });
  }

  const rect = (x1, y1, x2, y2) => ({
    left:   Math.min(x1, x2),
    top:    Math.min(y1, y2),
    width:  Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  });

  /* crop and send PNG + generated filename to sidebar */
  function cropAndSend(src, r) {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio;
      const canvas = document.createElement('canvas');
      canvas.width  = r.width  * dpr;
      canvas.height = r.height * dpr;
      canvas.getContext('2d').drawImage(
        img,
        r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr,
        0, 0, canvas.width, canvas.height
      );
      const png  = canvas.toDataURL('image/png');
      const name = `screenshot_${new Date().toISOString().replace(/[^\d]/g,'').slice(0,15)}.png`;

      chrome.runtime.sendMessage({ type: 'imageCaptured', dataUrl: png, name });
    };
    img.src = src;
  }

  /*════════════ 3. AUTO-INJECT ════════════*/
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSidebar);
  } else {
    injectSidebar();
  }
})();
