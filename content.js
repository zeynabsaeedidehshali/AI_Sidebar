// content.js — injects the sidebar into every page

const SIDEBAR_ID      = 'my-ai-sidebar';
const CONTAINER_ID    = `${SIDEBAR_ID}-container`;
const HANDLE_ID       = `${SIDEBAR_ID}-handle`;
const MINIMIZE_BTN_ID = `${SIDEBAR_ID}-minimize-btn`;
const TOGGLE_BTN_ID   = `${SIDEBAR_ID}-toggle-btn`;

/* Inject once */
if (!document.getElementById(CONTAINER_ID)) {
  /* ─ Sidebar container ─ */
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '350px',
    minWidth: '220px',      // hard floor so content always fits
    height: '100%',
    display: 'flex',
    flexDirection: 'row',   // [minimize][handle][iframe]
    zIndex: '2147483647',
    overflow: 'hidden'
  });

  /* Minimize btn */
  const minimizeBtn = document.createElement('div');
  minimizeBtn.id = MINIMIZE_BTN_ID;
  minimizeBtn.textContent = '▶';
  Object.assign(minimizeBtn.style, {
    width: '20px',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#ccc',
    cursor: 'pointer',
    flex: '0 0 auto'
  });

  /* Resize handle (pink) */
  const handle = document.createElement('div');
  handle.id = HANDLE_ID;
  Object.assign(handle.style, {
    width: '8px',
    height: '100%',
    cursor: 'ew-resize',
    background: '#ff69b4',
    flex: '0 0 auto'
  });

  /* Hover tone */
  handle.addEventListener('pointerenter', () => {
    handle.style.background = '#ff85c1';
  });
  handle.addEventListener('pointerleave', () => {
    handle.style.background = '#ff69b4';
  });

  /* Iframe */
  const iframe = document.createElement('iframe');
  iframe.id = SIDEBAR_ID;
  iframe.src = chrome.runtime.getURL('sidebar.html');
  Object.assign(iframe.style, {
    flex: '1 1 auto',
    height: '100%',
    border: 'none'
  });

  /* Assemble */
  container.append(minimizeBtn, handle, iframe);
  document.body.appendChild(container);

  /* Toggle button (shows when minimized) */
  const toggleBtn = document.createElement('div');
  toggleBtn.id = TOGGLE_BTN_ID;
  toggleBtn.textContent = '◀';
  Object.assign(toggleBtn.style, {
    position: 'fixed',
    top: '50%',
    right: '0',
    transform: 'translate(0,-50%)',
    width: '20px',
    height: '40px',
    display: 'none',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#ccc',
    cursor: 'pointer',
    zIndex: '2147483648'
  });
  document.body.appendChild(toggleBtn);

  minimizeBtn.onclick = () => {
    container.style.display = 'none';
    toggleBtn.style.display = 'flex';
  };
  toggleBtn.onclick = () => {
    container.style.display = 'flex';
    toggleBtn.style.display = 'none';
  };

  /* Drag-to-resize */
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);

    const startX     = e.clientX;
    const startWidth = parseInt(getComputedStyle(container).width, 10);
    const minW       = 220;
    const maxW       = window.innerWidth * 0.8;

    const onMove = ev => {
      const dx = startX - ev.clientX;
      let w    = startWidth + dx;
      w        = Math.max(minW, Math.min(maxW, w));
      container.style.width = `${w}px`;
    };
    const onUp = ev => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup',   onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup',   onUp);
  });
}
