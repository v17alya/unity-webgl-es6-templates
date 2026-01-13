/**
 * Slide Login Button module for Web builds (no index.html edits required).
 *
 * Features:
 * - Injects styles and DOM once; uses inline styles for dynamic sizing/colors
 * - Click toggles open/close; inner action button has independent click handler
 * - External control: set labels, set connected state, show/hide, open/close
 * - No external assets: inline SVG logo; configurable sizing/color
 * - Install button with white border and hover effects, can be enabled/disabled externally
 *
 * Usage example:
 *   import { LoginButton } from './loginButton.js';
 *   LoginButton.init({ 
 *     onClick: () => connect(), 
 *     onInstallClick: () => install(),
 *     connectLabel: 'Connect', 
 *     disconnectLabel: 'Disconnect',
 *     installLabel: 'Install'
 *   });
 *   // After wallet connected:
 *   LoginButton.setConnected(true);
 *   // To hide/show:
 *   LoginButton.hide();
 *   LoginButton.show();
 */

const DEFAULTS = {
  topPx: 16,
  heightPx: 64,
  widthPx: 162, // Original width for single button
  paddingPx: 6,
  logoBoxPx: 56,
  logoSizePx: 38,
  color: '#190066',
  zIndex: 9995,
  connectLabel: 'Connect',
  disconnectLabel: 'Disconnect',
  installLabel: 'Install',
};

const STATE = {
  root: null,
  logo: null,
  action: null,
  install: null,
  isOpen: false,
  isVisible: true,
  isConnected: false,
  onClick: null,
  onInstallClick: null,
  opts: { ...DEFAULTS },
  styleId: 'uwb-login-style',
};

/**
 * Ensure the scoped CSS is injected once into the document head.
 * @returns {void}
 */
function ensureStylesInjected() {
  if (document.getElementById(STATE.styleId)) return;
  const style = document.createElement('style');
  style.id = STATE.styleId;
  style.type = 'text/css';
  style.textContent = [
    '/* Web Wallet Slide Button (scoped) */',
    '.uwb-login { position: fixed; right: 0; border-radius: 8px 0 0 8px; display: flex; flex-direction: row; align-items: center; gap: 0; box-shadow: 0 2px 3px rgba(7,7,8,0.2), 0 6px 10px 4px rgba(7,7,8,0.1); overflow: hidden; transition: transform .35s ease; }',
    '.uwb-login__buttons { display: flex; flex-direction: row; align-items: center; justify-content: center; }',
    '.uwb-login.open { transform: translateX(0); }',
    '.uwb-login__logo { border-radius: 8px; display: grid; place-items: center; flex: 0 0 auto; cursor: pointer; box-sizing: border-box; }',
    '.uwb-login__logo svg { display: block; color-scheme: light only; forced-color-adjust: none; filter: none; }',
    '.uwb-login__action { color: #fff; background: transparent; border: 2px solid #fff; border-radius: 6px; cursor: pointer; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0 12px; margin: 0 8px; font: 500 14px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif; transition: all 0.2s ease; width: 120px; flex-shrink: 0; }',
    '.uwb-login__action:hover { background: #fff; color: #000; }',
    '.uwb-login__install { color: #fff; background: transparent; border: 2px solid #fff; border-radius: 6px; cursor: pointer; height: 40px; display: flex; align-items: center; justify-content: center; padding: 0 12px; margin: 0 0px; font: 500 14px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif; transition: all 0.2s ease; width: 120px; flex-shrink: 0; }',
    '.uwb-login__install:hover { background: #fff; color: #000; }',
    '.uwb-login__install:disabled { opacity: 0.5; cursor: not-allowed; border-color: #ccc; color: #ccc; }',
    '.uwb-login__install:disabled:hover { background: transparent; color: #ccc; }',
    '.uwb-login__install:disabled { display: none; }',
    '.uwb-login--hidden { visibility: hidden; pointer-events: none; }',
    '/* Dark theme compatibility for SVG */',
    '@media (prefers-color-scheme: dark) {',
    '  .uwb-login__logo svg { filter: none !important; }',
    '}',
    '/* Prevent browser dark mode filters */',
    '.uwb-login__logo svg * { color-scheme: light only; forced-color-adjust: none; }',
  ].join('\n');
  document.head.appendChild(style);
}

/**
 * Lazily create and attach the login button DOM if it does not yet exist.
 * Wires event handlers and applies initial styles.
 * @returns {void}
 */
function createDomIfNeeded() {
  if (STATE.root) return;
  ensureStylesInjected();

  const root = document.createElement('div');
  root.className = 'uwb-login';
  root.setAttribute('role', 'button');
  root.setAttribute('aria-label', 'Open login');
  applyRootStyles(root);

  const logo = document.createElement('div');
  logo.className = 'uwb-login__logo';
  applyLogoBoxStyles(logo);
  logo.innerHTML = getLogoSvg();
  const svg = logo.querySelector('svg');
  if (svg) applyLogoSvgStyles(svg);

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'uwb-login__action';
  action.textContent = STATE.opts.connectLabel;

  const install = document.createElement('button');
  install.type = 'button';
  install.className = 'uwb-login__install';
  install.textContent = STATE.opts.installLabel;

  // Create buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'uwb-login__buttons';
  buttonsContainer.appendChild(action);
  buttonsContainer.appendChild(install);
  
  root.appendChild(logo);
  root.appendChild(buttonsContainer);
  document.body.appendChild(root);

  // Root click handler (for toggling open/close)
  root.addEventListener('click', (ev) => {
    // // Don't toggle if clicking on logo or action button
    // if (ev.target === logo || ev.target === action || ev.target.closest('.uwb-login__logo') || ev.target.closest('.uwb-login__action')) {
    //   return;
    // }

    // Only toggle if the button is closed (collapsed)
    if (!STATE.isOpen) {
      if (typeof STATE.onLogoClick === 'function') {
        STATE.onLogoClick(true);
      }
    }
    toggle();
  });

  action.addEventListener('click', (ev) => {
    ev.stopPropagation();
    
    // Only allow clicks when the button is open
    if (!STATE.isOpen) {
      return;
    }
    
    if (typeof STATE.onClick === 'function') {
      STATE.onClick({ connected: STATE.isConnected });
    }
  });

  install.addEventListener('click', (ev) => {
    ev.stopPropagation();
    
    // Only allow clicks when the button is open and enabled
    if (!STATE.isOpen || install.disabled) {
      return;
    }
    
    if (typeof STATE.onInstallClick === 'function') {
      STATE.onInstallClick();
    }
  });

  STATE.root = root;
  STATE.logo = logo;
  STATE.action = action;
  STATE.install = install;
  
  // Set initial collapsed state
  STATE.isOpen = false;
  STATE.root.style.transform = calculateCollapsedTransform();
  
  // Update button states initially
  updateButtonStates();

  // Close when clicking outside of the widget
  document.addEventListener('click', onDocumentClick);
}

/**
 * Update the button states based on the open/closed state.
 * @returns {void}
 */
function updateButtonStates() {
  if (STATE.action) {
    if (STATE.isOpen) {
      STATE.action.style.pointerEvents = 'auto';
      STATE.action.style.cursor = 'pointer';
    } else {
      STATE.action.style.pointerEvents = 'none';
      STATE.action.style.cursor = 'default';
    }
  }
  
  if (STATE.install) {
    if (STATE.isOpen && !STATE.install.disabled) {
      STATE.install.style.pointerEvents = 'auto';
      STATE.install.style.cursor = 'pointer';
    } else {
      STATE.install.style.pointerEvents = 'none';
      STATE.install.style.cursor = 'default';
    }
  }
}

/**
 * Calculate the current width needed for the button panel.
 * @returns {number} Width in pixels.
 */
function calculateCurrentWidth() {
  const o = STATE.opts;
  if (STATE.install && !STATE.install.disabled) {
    // Two buttons: logo + padding + buttonsContainer(+ connect + install + padding)
    return o.paddingPx + o.logoBoxPx + o.paddingPx + 120 + o.paddingPx + 120 + o.paddingPx;
  } else {
    // Single button: logo + padding + buttonsContainer(margin-left: 8px + connect + padding)
    return o.paddingPx + o.logoBoxPx + o.paddingPx + 120 + o.paddingPx;
  }
}
  
/**
 * Calculate the width for collapsed state (only logo visible).
 * @returns {number} Width in pixels.
 */
function calculateCollapsedWidth() {
  const o = STATE.opts;
  return o.paddingPx + o.logoBoxPx + o.paddingPx;
}

/**
 * Calculate the transform offset for collapsed state.
 * @returns {string} CSS transform value.
 */
function calculateCollapsedTransform() {
  const o = STATE.opts;
  const collapsedWidth = o.paddingPx + o.logoBoxPx + o.paddingPx;
  return `translateX(calc(100% - ${collapsedWidth}px))`;
}

/**
 * Apply dynamic inline styles to the root container element.
 * @param {HTMLElement} rootEl - The root container element.
 * @returns {void}
 */
function applyRootStyles(rootEl) {
  const o = STATE.opts;
  const fullWidth = calculateCurrentWidth();
  
  rootEl.style.top = `${o.topPx}px`;
  rootEl.style.height = `${o.heightPx}px`;
  rootEl.style.width = `${fullWidth}px`;
  rootEl.style.padding = `0 ${o.paddingPx}px`;
  rootEl.style.background = o.color;
  rootEl.style.zIndex = String(o.zIndex);
}

/**
 * Apply sizing to the logo container box.
 * @param {HTMLElement} logoEl - The logo container element.
 * @returns {void}
 */
function applyLogoBoxStyles(logoEl) {
  const o = STATE.opts;
  logoEl.style.width = `${o.logoBoxPx}px`;
  logoEl.style.height = `${o.logoBoxPx}px`;
}

/**
 * Apply sizing to the inline SVG logo.
 * @param {SVGElement} svgEl - The logo SVG element.
 * @returns {void}
 */
function applyLogoSvgStyles(svgEl) {
  const o = STATE.opts;
  svgEl.style.width = `${o.logoSizePx}px`;
  svgEl.style.height = `${o.logoSizePx}px`;
  
  // Apply dark theme compatibility styles
  svgEl.style.colorScheme = 'light only';
  svgEl.style.forcedColorAdjust = 'none';
  svgEl.style.filter = 'none';
  
  // Apply styles to all path elements within the SVG
  const paths = svgEl.querySelectorAll('path');
  paths.forEach(path => {
    path.style.colorScheme = 'light only';
    path.style.forcedColorAdjust = 'none';
  });
}

/**
 * Get the inline SVG string for the logo.
 * Uses the corrected SVG markup provided by design with dark theme compatibility.
 * @returns {string} SVG markup string.
 */
function getLogoSvg() {
  return [
    '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 142 136.878" style="enable-background:new 0 0 142 136.878; color-scheme: light only; forced-color-adjust: none;" xml:space="preserve" aria-hidden="true" focusable="false">',
    '<path style="fill:#FF5C16;" d="M132.682,132.192l-30.583-9.106l-23.063,13.787l-16.092-0.007l-23.077-13.78l-30.569,9.106L0,100.801 l9.299-34.839L0,36.507L9.299,0l47.766,28.538h27.85L132.682,0l9.299,36.507l-9.299,29.455l9.299,34.839L132.682,132.192 L132.682,132.192z"/>',
    '<path style="fill:#FF5C16;" d="M9.305,0l47.767,28.558l-1.899,19.599L9.305,0z M39.875,100.814l21.017,16.01l-21.017,6.261 C39.875,123.085,39.875,100.814,39.875,100.814z M59.212,74.345l-4.039-26.174L29.317,65.97l-0.014-0.007v0.013l0.08,18.321 l10.485-9.951L59.212,74.345L59.212,74.345z M132.682,0L84.915,28.558l1.893,19.599L132.682,0z M102.113,100.814l-21.018,16.01 l21.018,6.261V100.814z M112.678,65.975h0.007H112.678v-0.013l-0.006,0.007L86.815,48.171l-4.039,26.174h19.336l10.492,9.95 C112.604,84.295,112.678,65.975,112.678,65.975z"/>',
    '<path style="fill:#E34807;" d="M39.868,123.085l-30.569,9.106L0,100.814h39.868C39.868,100.814,39.868,123.085,39.868,123.085z  M59.205,74.338l5.839,37.84l-8.093-21.04L29.37,84.295l10.491-9.956h19.344L59.205,74.338z M102.112,123.085l30.57,9.106 l9.299-31.378h-39.869C102.112,100.814,102.112,123.085,102.112,123.085z M82.776,74.338l-5.839,37.84l8.092-21.04 l27.583-6.843l-10.498-9.956H82.776V74.338z"/>',
    '<path style="fill:#FF8D5D;" d="M0,100.801l9.299-34.839h19.997l0.073,18.327l27.584,6.843l8.092,21.039l-4.16,4.633l-21.017-16.01H0 V100.801z M141.981,100.801l-9.299-34.839h-19.998l-0.073,18.327l-27.582,6.843l-8.093,21.039l4.159,4.633l21.018-16.01h39.868 V100.801z M84.915,28.538h-27.85l-1.891,19.599l9.872,64.013h11.891l9.878-64.013L84.915,28.538z"/>',
    '<path style="fill:#661800;" d="M9.299,0L0,36.507l9.299,29.455h19.997l25.87-17.804L9.299,0z M53.426,81.938h-9.059l-4.932,4.835 l17.524,4.344l-3.533-9.186V81.938z M132.682,0l9.299,36.507l-9.299,29.455h-19.998L86.815,48.158L132.682,0z M88.568,81.938h9.072 l4.932,4.841l-17.544,4.353l3.54-9.201V81.938z M79.029,124.385l2.067-7.567l-4.16-4.633h-11.9l-4.159,4.633l2.066,7.567"/>',
    '<path style="fill:#C0C4CD;" d="M79.029,124.384v12.495H62.945v-12.495L79.029,124.384L79.029,124.384z"/>',
    '<path style="fill:#E7EBF6;" d="M39.875,123.072l23.083,13.8v-12.495l-2.067-7.566C60.891,116.811,39.875,123.072,39.875,123.072z  M102.113,123.072l-23.084,13.8v-12.495l2.067-7.566C81.096,116.811,102.113,123.072,102.113,123.072z"/>',
    '</svg>',
  ].join('');
}

/**
 * Update UI labels for connect/disconnect states.
 * @param {{connectLabel?: string, disconnectLabel?: string, installLabel?: string}} param0 - Optional labels.
 * @returns {void}
 */
function setLabels({ connectLabel, disconnectLabel, installLabel }) {
  if (typeof connectLabel === 'string') STATE.opts.connectLabel = connectLabel;
  if (typeof disconnectLabel === 'string') STATE.opts.disconnectLabel = disconnectLabel;
  if (typeof installLabel === 'string') STATE.opts.installLabel = installLabel;
  if (STATE.action) updateLabel();
  if (STATE.install) updateInstallLabel();
}

/**
 * Refresh the action button label based on connection state.
 * @returns {void}
 */
function updateLabel() {
  if (!STATE.action) return;
  STATE.action.textContent = STATE.isConnected ? STATE.opts.disconnectLabel : STATE.opts.connectLabel;
}

/**
 * Refresh the install button label.
 * @returns {void}
 */
function updateInstallLabel() {
  if (!STATE.install) return;
  STATE.install.textContent = STATE.opts.installLabel;
}

/**
 * Mark the UI as connected or disconnected.
 * @param {boolean} connected - Connection state.
 * @returns {void}
 */
function setConnected(connected) {
  STATE.isConnected = !!connected;
  updateLabel();
}

/**
 * Provide a click handler for the inner action button.
 * @param {(ctx: {connected: boolean}) => void} handler - Click callback.
 * @returns {void}
 */
function setOnClick(handler) {
  STATE.onClick = handler;
}

/**
 * Provide a click handler for the install button.
 * @param {() => void} handler - Install click callback.
 * @returns {void}
 */
function setOnInstallClick(handler) {
  STATE.onInstallClick = handler;
}

/**
 * Enable or disable the install button.
 * @param {boolean} enabled - Whether the install button should be enabled.
 * @returns {void}
 */
function setInstallButtonEnabled(enabled) {
  if (STATE.install) {
    STATE.install.disabled = !enabled;
    updateButtonStates();
    
    // Recalculate and apply new width when button state changes
    if (STATE.root) {
      const newWidth = calculateCurrentWidth();
      STATE.root.style.width = `${newWidth}px`;
    }
  }
}

/**
 * Provide a click handler for the logo button.
 * @param {(opened: boolean) => void} handler - Logo click callback.
 * @returns {void}
 */
function setOnLogoClick(handler) {
  STATE.onLogoClick = handler;
}

/**
 * Provide a click handler for the closed button.
 * @param {() => void} handler - Closed click callback.
 * @returns {void}
 */
function setOnClosed(handler) {
  STATE.onClosed = handler;
}

/**
 * Slide the button fully into view.
 * @returns {void}
 */
function open() {
  createDomIfNeeded();
  STATE.isOpen = true;
  
  STATE.root.classList.add('open');
  STATE.root.style.transform = 'translateX(0)';
  updateButtonStates();
}

/**
 * Collapse the button, leaving the logo tab visible.
 * @returns {void}
 */
function close() {
  createDomIfNeeded();
  STATE.isOpen = false;
  
  STATE.root.classList.remove('open');
  STATE.root.style.transform = calculateCollapsedTransform();
  updateButtonStates();
  if (typeof STATE.onClosed === 'function') {
    STATE.onClosed();
  }
}

/**
 * Toggle between open and closed states.
 * @returns {void}
 */
function toggle() {
  if (!STATE.root) { open(); return; }
  (STATE.isOpen ? close : open)();
}

/**
 * Handle outside clicks to close the widget when open.
 * @param {MouseEvent} ev
 * @returns {void}
 */
function onDocumentClick(ev) {
  if (!STATE.root || !STATE.isOpen) return;
  const target = ev.target;
  if (STATE.root.contains(target)) return;
  close();
}

/**
 * Hide the widget and disable interactions.
 * @returns {void}
 */
function hide() {
  createDomIfNeeded();
  close();
  STATE.isVisible = false;
  STATE.root.classList.add('uwb-login--hidden');
}

/**
 * Show the widget and restore interactions.
 * @returns {void}
 */
function show() {
  createDomIfNeeded();
  STATE.isVisible = true;
  STATE.root.classList.remove('uwb-login--hidden');
  close();
}

/**
 * Adjust layout sizes and reflow the widget.
 * @param {{heightPx?: number, widthPx?: number, logoBoxPx?: number, logoSizePx?: number, paddingPx?: number}} param0 - Optional sizing overrides in pixels.
 * @returns {void}
 */
function setSizes({ heightPx, widthPx, logoBoxPx, logoSizePx, paddingPx }) {
  const o = STATE.opts;
  if (typeof heightPx === 'number') o.heightPx = heightPx;
  if (typeof widthPx === 'number') o.widthPx = widthPx;
  if (typeof logoBoxPx === 'number') o.logoBoxPx = logoBoxPx;
  if (typeof logoSizePx === 'number') o.logoSizePx = logoSizePx;
  if (typeof paddingPx === 'number') o.paddingPx = paddingPx;
  if (STATE.root) applyRootStyles(STATE.root);
  if (STATE.logo) applyLogoBoxStyles(STATE.logo);
  const svg = STATE.logo ? STATE.logo.querySelector('svg') : null;
  if (svg) applyLogoSvgStyles(svg);
  if (!STATE.isOpen) close();
}

/**
 * Set the background color of the widget.
 * @param {string} color - Any valid CSS color.
 * @returns {void}
 */
function setColor(color) {
  STATE.opts.color = color;
  if (STATE.root) STATE.root.style.background = color;
}

/**
 * Initialize the widget and attach to the DOM.
 * @param {{ onClick?: (ctx: {connected: boolean}) => void, onInstallClick?: () => void, onLogoClick?: (opened: boolean) => void, onClosed?: () => void, topPx?: number, heightPx?: number, widthPx?: number, paddingPx?: number, logoBoxPx?: number, logoSizePx?: number, color?: string, zIndex?: number, connectLabel?: string, disconnectLabel?: string, installLabel?: string, connected?: boolean }} [options] - Initialization options.
 * @returns {typeof api} Public API for further control.
 */
function init(options = {}) {
  STATE.opts = { ...DEFAULTS, ...options };
  STATE.onClick = options.onClick || null;
  STATE.onInstallClick = options.onInstallClick || null;
  STATE.onLogoClick = options.onLogoClick || null;
  STATE.onClosed = options.onClosed || null;
  setConnected(options.connected || false);
  createDomIfNeeded();
  updateLabel();
  updateInstallLabel();
  return api;
}

/**
 * Remove the widget and release references.
 * @returns {void}
 */
function destroy() {
  if (!STATE.root) return;
  try { document.removeEventListener('click', onDocumentClick); } catch {}
  try { STATE.root.remove(); } catch {}
  STATE.root = null; STATE.logo = null; STATE.action = null; STATE.install = null;
}

const api = {
  init,
  setOnClick,
  setOnInstallClick,
  setOnLogoClick,
  setLabels,
  setConnected,
  setOnClosed,
  setInstallButtonEnabled,
  show,
  hide,
  open,
  close,
  toggle,
  setSizes,
  setColor,
  destroy,
  get root() { return STATE.root; },
};

export { api as LoginButton };