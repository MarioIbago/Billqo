let guardsInstalled = false;

function preventBrowserAction(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

export function installClientGuards(): void {
  if (guardsInstalled || typeof window === 'undefined') return;
  guardsInstalled = true;

  // These are interface-level deterrents only. They reduce accidental copying
  // and common DevTools shortcuts, but they are not a security boundary.
  window.addEventListener('contextmenu', preventBrowserAction, { capture: true });
  window.addEventListener('copy', preventBrowserAction, { capture: true });
  window.addEventListener('cut', preventBrowserAction, { capture: true });

  window.addEventListener('dragstart', (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) preventBrowserAction(event);
  }, { capture: true });

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const control = event.ctrlKey || event.metaKey;
    const devToolsChord = control && event.shiftKey && ['c', 'i', 'j', 'k'].includes(key);
    const macDevToolsChord = event.metaKey && event.altKey && ['c', 'i', 'j'].includes(key);
    const viewSource = control && key === 'u';

    if (event.key === 'F12' || devToolsChord || macDevToolsChord || viewSource) {
      preventBrowserAction(event);
    }

    // Intentionally leave reload and browser-data controls untouched:
    // F5, Ctrl/Cmd+R, Ctrl/Cmd+Shift+R and Ctrl/Cmd+Shift+Delete keep working.
  }, { capture: true });
}
