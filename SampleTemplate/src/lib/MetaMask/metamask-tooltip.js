/**
 * MetaMask Tooltip module for Web builds (no index.html edits required).
 *
 * Features:
 * - Injects tooltip DOM and CSS dynamically when initialized
 * - Configurable event handlers for install and cancel actions
 * - Appears below the login button as a small informative popup
 * - No external dependencies
 *
 * Usage example:
 *   MetaMaskTooltip.init({
 *     onInstall: () => window.open('https://metamask.io/download/', '_blank'),
 *     onCancel: () => console.log('User cancelled'),
 *     storageKey: 'customTooltipShown'
 *   });
 *   
 *   // Show tooltip manually
 *   MetaMaskTooltip.show();
 *   
 *   // Check if should show (once per session)
 *   if (MetaMaskTooltip.shouldShow()) {
 *     MetaMaskTooltip.show();
 *   }
 */

(function(){
  'use strict';

  const STATE = {
    overlay: null,
    hasShown: false,
    storageKey: 'mmTooltipShown',
    onInstall: null,
    onConnect: null,
    cssLoaded: false,
    targetElement: null
  };

  /**
   * Load CSS file dynamically
   * @param {string} href - CSS file path
   * @returns {Promise} Promise that resolves when CSS is loaded
   */
  function loadCSS(href) {
    return new Promise(function(resolve, reject) {
      if (STATE.cssLoaded) {
        resolve();
        return;
      }
      
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      
      link.onload = function() {
        STATE.cssLoaded = true;
        resolve();
      };
      
      link.onerror = function() {
        reject(new Error('Failed to load CSS: ' + href));
      };
      
      document.head.appendChild(link);
    });
  }
    
  /**
   * Save the has shown state to localStorage
   * @param {boolean} value - The value to save
   * @returns {void}
   */
  function saveHasShown(value) {
    try {
      STATE.hasShown = value; 
      localStorage.setItem(STATE.storageKey, value); 
    } catch(error){ console.error('MetaMask Tooltip: Failed to save has shown state', error); }
  }

  /**
   * Create and inject tooltip DOM elements
   * @returns {void}
   */
  function ensureDom() {
    if (STATE.overlay) return;
    
    var overlay = document.createElement('div');
    overlay.id = 'mm-tooltip-overlay';
    overlay.className = 'mm-tooltip-overlay';
    overlay.innerHTML = [
      '<div class="mm-tooltip">',
      '  <div class="mm-tooltip-header">',
      '    <div class="mm-tooltip-logo">',
      '      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 142 136.878" aria-hidden="true" focusable="false">',
      '        <path style="fill:#FF5C16;" d="M132.682,132.192l-30.583-9.106l-23.063,13.787l-16.092-0.007l-23.077-13.78l-30.569,9.106L0,100.801 l9.299-34.839L0,36.507L9.299,0l47.766,28.538h27.85L132.682,0l9.299,36.507l-9.299,29.455l9.299,34.839L132.682,132.192 L132.682,132.192z"/>',
      '        <path style="fill:#FF5C16;" d="M9.305,0l47.767,28.558l-1.899,19.599L9.305,0z M39.875,100.814l21.017,16.01l-21.017,6.261 C39.875,123.085,39.875,100.814,39.875,100.814z M59.212,74.345l-4.039-26.174L29.317,65.97l-0.014-0.007v0.013l0.08,18.321 l10.485-9.951L59.212,74.345L59.212,74.345z M132.682,0L84.915,28.558l1.893,19.599L132.682,0z M102.113,100.814l-21.018,16.01 l21.018,6.261V100.814z M112.678,65.975h0.007H112.678v-0.013l-0.006,0.007L86.815,48.171l-4.039,26.174h19.336l10.492,9.95 C112.604,84.295,112.678,65.975,112.678,65.975z"/>',
      '        <path style="fill:#E34807;" d="M39.868,123.085l-30.569,9.106L0,100.814h39.868C39.868,100.814,39.868,123.085,39.868,123.085z  M59.205,74.338l5.839,37.84l-8.093-21.04L29.37,84.295l10.491-9.956h19.344L59.205,74.338z M102.112,123.085l30.57,9.106 l9.299-31.378h-39.869C102.112,100.814,102.112,123.085,102.112,123.085z M82.776,74.338l-5.839,37.84l8.092-21.04 l27.583-6.843l-10.498-9.956H82.776V74.338z"/>',
      '        <path style="fill:#FF8D5D;" d="M0,100.801l9.299-34.839h19.997l0.073,18.327l27.584,6.843l8.092,21.039l-4.16,4.633l-21.017-16.01H0 V100.801z M141.981,100.801l-9.299-34.839h-19.998l-0.073,18.327l-27.582,6.843l-8.093,21.039l4.159,4.633l21.018-16.01h39.868 V100.801z M84.915,28.538h-27.85l-1.891,19.599l9.872,64.013h11.891l9.878-64.013L84.915,28.538z"/>',
      '        <path style="fill:#661800;" d="M9.299,0L0,36.507l9.299,29.455h19.997l25.87-17.804L9.299,0z M53.426,81.938h-9.059l-4.932,4.835 l17.524,4.344l-3.533-9.186V81.938z M132.682,0l9.299,36.507l-9.299,29.455h-19.998L86.815,48.158L132.682,0z M88.568,81.938h9.072 l4.932,4.841l-17.544,4.353l3.54-9.201V81.938z M79.029,124.385l2.067-7.567l-4.16-4.633h-11.9l-4.159,4.633l2.066,7.567"/>',
      '        <path style="fill:#C0C4CD;" d="M79.029,124.384v12.495H62.945v-12.495L79.029,124.384L79.029,124.384z"/>',
      '        <path style="fill:#E7EBF6;" d="M39.875,123.072l23.083,13.8v-12.495l-2.067-7.566C60.891,116.811,39.875,123.072,39.875,123.072z  M102.113,123.072l-23.084,13.8v-12.495l2.067-7.566C81.096,116.811,102.113,123.072,102.113,123.072z"/>',
      '      </svg>',
      '    </div>',
      '    <h3 class="mm-tooltip-title">MetaMask</h3>',
      '  </div>',
      '  <div class="mm-tooltip-text">Do you have the MetaMask app installed? If not, go to the store and install it.</div>',
      '  <div class="mm-tooltip-buttons">',
      '    <button class="mm-tooltip-btn mm-tooltip-btn-primary" data-mm-install>Install</button>',
      '    <button class="mm-tooltip-btn mm-tooltip-btn-secondary" data-mm-connect>Connect</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    // Wire buttons with custom event handlers
    var installBtn = overlay.querySelector('[data-mm-install]');
    var connectBtn = overlay.querySelector('[data-mm-connect]');
    
    if (installBtn) {
        installBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        saveHasShown(true);
        close();
        if (typeof STATE.onInstall === 'function') {
          STATE.onInstall();
        } else {
          api.install();
        }
      });
    }
    
    if (connectBtn) {
        connectBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        saveHasShown(true);
        close();
        if (typeof STATE.onConnect === 'function') {
          STATE.onConnect();
        } else {
          close();
        }
      });
    }
    
    // // Click outside to close - only when clicking on the overlay background
    // overlay.addEventListener('click', function(e){ 
    //   // Only close if clicking on the overlay background, not on the tooltip
    //   if (e.target === overlay) {
    //     close();
    //   }
    // });

    // Prevent clicks on tooltip from closing it
    const tooltip = overlay.querySelector('.mm-tooltip');
    if (tooltip) {
      tooltip.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    STATE.overlay = overlay;
  }

  /**
   * Position the tooltip below the target element
   * @returns {void}
   */
  function positionTooltip() {
    if (!STATE.overlay || !STATE.targetElement) {
      console.warn('MetaMask Tooltip: Cannot position - missing overlay or target element');
      return;
    }
    
    const tooltip = STATE.overlay.querySelector('.mm-tooltip');
    if (!tooltip) {
      console.warn('MetaMask Tooltip: Cannot position - tooltip element not found');
      return;
    }
    
    const targetRect = STATE.targetElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position tooltip below the target element
    const top = targetRect.bottom + 10;
    const left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
    
    // Ensure tooltip doesn't go off-screen
    const maxLeft = window.innerWidth - tooltipRect.width - 20;
    const adjustedLeft = Math.max(20, Math.min(left, maxLeft));
    
    tooltip.style.top = top + 'px';
    tooltip.style.left = adjustedLeft + 'px';
    
    // Adjust arrow position if tooltip is repositioned
    const arrowOffset = left - adjustedLeft;
    if (Math.abs(arrowOffset) > 0) {
      tooltip.style.setProperty('--arrow-offset', arrowOffset + 'px');
    }
  }

  /**
   * Show the tooltip
   * @returns {void}
   */
  function show() {
    ensureDom();
    
    // Check if we have a target element for positioning
    if (!STATE.targetElement) {
      console.warn('MetaMask Tooltip: No target element set for positioning');
      return;
    }
    
    positionTooltip();
    STATE.overlay.classList.add('show');
    
    // Enable pointer events for the tooltip itself
    const tooltip = STATE.overlay.querySelector('.mm-tooltip');
    if (tooltip) {
      tooltip.style.pointerEvents = 'auto';
    }
    
    // Reposition on window resize
    window.addEventListener('resize', positionTooltip);
  }

  /**
   * Hide the tooltip
   * @returns {void}
   */
  function close() {
    if (!STATE.overlay) return;
    STATE.overlay.classList.remove('show');
    
    // Reset pointer events
    const tooltip = STATE.overlay.querySelector('.mm-tooltip');
    if (tooltip) {
      tooltip.style.pointerEvents = 'none';
    }
    
    window.removeEventListener('resize', positionTooltip);
  }

  /**
   * Default install action - redirect to MetaMask download
   * @returns {void}
   */
  function install() {
    try { 
      window.open('https://metamask.io/download/', '_blank'); 
    } catch(error){ console.error('MetaMask Tooltip: Failed to open download page', error); }
  }

  /**
   * Check if tooltip should be shown (once per session)
   * @returns {boolean} True if should show
   */
  function shouldShow() {
    if (STATE.hasShown) return false;
    return true;
  }

  /**
   * Show tooltip if conditions are met (once per session)
   * @returns {boolean} True if tooltip was shown
   */
  function showIfNeeded() {
    if (!shouldShow()) return false;
    
    try { 
      show(); 
    } catch(error){ console.error('MetaMask Tooltip: Failed to show', error); }
    return true;
  }

  /**
   * Initialize the tooltip with options
   * @param {Object} options - Configuration options
   * @param {Function} [options.onInstall] - Custom install button handler
   * @param {Function} [options.onConnect] - Custom connect button handler
   * @param {string} [options.storageKey] - Custom localStorage key
   * @param {string} [options.cssPath] - Custom CSS file path
   * @param {HTMLElement} [options.targetElement] - Element to position tooltip below
   * @returns {Object} Tooltip API
   */
  function init(options) {
    options = options || {};
    // Set custom event handlers
    if (typeof options.onInstall === 'function') {
      STATE.onInstall = options.onInstall;
    }
    
    if (typeof options.onConnect === 'function') {
      STATE.onConnect = options.onConnect;
    }
    
    // Set custom storage key
    if (options.storageKey && typeof options.storageKey === 'string') {
      STATE.storageKey = options.storageKey;
    }
    
    // Set target element for positioning
    if (options.targetElement) {
      STATE.targetElement = options.targetElement;
    }
    
    // Load CSS file
    var cssPath = options.cssPath || 'src/lib/MetaMask/metamask-tooltip.css';
    loadCSS(cssPath).catch(function(error) {
      console.error('MetaMask Tooltip: Failed to load CSS:', error.message);
    });
    
    // Read history from localStorage
    try { 
        STATE.hasShown = (localStorage.getItem(STATE.storageKey) === '1'); 
    } catch(error){ console.error('MetaMask Tooltip: Failed to get has shown state', error); }
    
    return api;
  }

  var api = {
    init: init,
    show: show,
    close: close,
    showIfNeeded: showIfNeeded,
    install: install,
    shouldShow: shouldShow,
    saveHasShown: saveHasShown,
  };

  window.MetaMaskTooltip = api;

})(typeof window !== 'undefined' ? window : this);
