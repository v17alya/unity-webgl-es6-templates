# Full-Featured Unity WebGL Template

A comprehensive, production-ready Unity WebGL template built with ES6 modules. This template includes extensive features for analytics, authentication, payments, and more.

## ⚠️ Important Note

**This is NOT a ready-to-use template out of the box.** This template is an **example/reference implementation** that demonstrates a full-featured WebGL template architecture with modular ES6 code.

To make this template work properly, you need to:

1. **Implement C# code in Unity** - Many features require corresponding C# scripts in your Unity project:
   - Unity-to-JavaScript communication bridges
   - Event handlers for analytics, payments, authentication
   - Game-specific integration points
   - Memory management callbacks for diagnostics

2. **Configure all services** - Replace placeholder API keys and credentials with your own:
   - Firebase configuration
   - Google Analytics
   - Xsolla payment system
   - Analytics endpoints
   - Asset URLs

3. **Customize for your project** - Adapt the code to match your specific game/project requirements:
   - Update event names and structures
   - Modify UI elements
   - Adjust bootstrap stages
   - Customize error handling

This template serves as a **reference implementation** showing how to structure a modular WebGL template with advanced features. Use it as a starting point and adapt it to your needs.

## Features

- ✅ **ES6 Modular Architecture**: Clean, maintainable code structure using native JavaScript modules
- ✅ **Analytics Integration**: Amplitude and Google Analytics support with event tracking
- ✅ **Firebase Integration**: Authentication, logging, and real-time database support
- ✅ **Payment Processing**: Xsolla PayStation and Metaframe integration
- ✅ **Web3 Support**: MetaMask integration for blockchain connectivity
- ✅ **Video Streaming**: Optional video controller for streaming content
- ✅ **Progress Tracking**: Sophisticated multi-stage progress visualization
- ✅ **Error Handling**: Comprehensive error collection with WebGL diagnostics
- ✅ **Mobile Optimization**: Mobile-specific builds and UI handling
- ✅ **SEO Support**: Sitemap, robots.txt, and meta tags configuration
- ✅ **OAuth Flows**: Xsolla OAuth integration with callback handling
- ✅ **Discord Integration**: Discord Rich Presence support
- ✅ **Audio System**: Advanced audio controller with format detection
- ✅ **Focus Tracking**: Tab visibility and focus state management
- ✅ **Configuration**: Centralized config with URL parameter overrides

## Structure

```
SampleTemplate/
├── index.html                 # Main HTML entry point
├── robots.txt                 # SEO robots file
├── sitemap.xml                # SEO sitemap
├── src/                       # JavaScript modules
│   ├── bootstrapper.module.js    # Main orchestration
│   ├── config.module.js          # Centralized configuration
│   ├── logger.module.js          # Logging system
│   ├── errorHandler.module.js    # Error handling
│   ├── unity.module.js           # Unity loader integration
│   ├── progress_ui.module.js     # Progress UI
│   ├── helpers.module.js         # Utility functions
│   ├── analytics.module.js       # Google Analytics
│   ├── amplitude.module.js       # Amplitude analytics
│   ├── firebaseAuth.module.js    # Firebase Auth
│   ├── firebaseLogs.module.js    # Firebase logging
│   ├── xsolla_paystation.module.js # Xsolla payments
│   ├── xsolla_metaframe.module.js  # Xsolla Metaframe
│   ├── xsolla_oauth.module.js      # Xsolla OAuth
│   ├── audio_controller.module.js  # Audio management
│   ├── focusTracker.module.js      # Focus tracking
│   ├── render.module.js            # Splash screen rendering
│   ├── stage_progress.module.js    # Stage-based progress
│   ├── eventTracker.module.js      # Event tracking
│   ├── analytics_core.module.js    # Analytics core
│   ├── analytics_events.module.js  # Event definitions
│   ├── cookies_constants.module.js # Cookie constants
│   ├── modulepath.bootstrap.js     # Module path setup
│   ├── app_version.js              # Version string
│   └── lib/                        # Third-party libraries
│       ├── MetaMask/               # MetaMask bridge
│       └── ClientDataJS/           # User agent parser
├── VideoController/            # Video streaming controller
│   ├── src/
│   └── css/
├── html/                       # Additional HTML pages
│   ├── mobile.html             # Mobile redirect page
│   ├── oauth_xsolla.html       # OAuth page
│   ├── oauth_xsolla_callback.html # OAuth callback
│   └── discord_wait.html       # Discord integration
├── TemplateData/               # Assets and resources
│   ├── css/
│   ├── diagnostics/
│   ├── mobile_error/
│   └── ...
└── audio/                      # Audio assets
```

## Configuration

### Required Configuration

Before using this template, you must configure the following in `src/config.module.js`:

1. **Assets URLs** - Replace placeholder URLs with your actual asset URLs
2. **Google Analytics** - Add your Google Analytics tracking ID
3. **Firebase** - Configure Firebase Auth and Logging credentials
4. **Xsolla** - Set up Xsolla project IDs, merchant IDs, and API keys
5. **Analytics Endpoint** - Configure your Amplitude/compatible analytics endpoint
6. **Web3/MetaMask** - Optionally configure Infura API key for Web3
7. **Cookie Prefix** - Customize cookie prefix in `cookies_constants.module.js`

### Example Configuration

```javascript
// In config.module.js
const ASSETS = {
  SPLASH_MOBILE: "https://your-cdn.com/splash-mobile.jpg",
  SPLASH_DESKTOP: "https://your-cdn.com/splash-desktop.jpg",
  LOGO: "https://your-cdn.com/logo.png",
};

const GOOGLE = {
  GTAG_ID: "G-XXXXXXXXXX", // Your Google Analytics ID
};

const FIREBASE_LOGS = {
  config: {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    // ... rest of Firebase config
  },
  pathPrefix: "YourLogsPath",
};
```

### URL Parameter Configuration

Many settings can be overridden via URL query parameters:

- `?debug=true` - Enable debug mode
- `?logLevel=0` - Set log level (0=All, 5=None)
- `?production=false` - Override production detection
- `?web3Enabled=true` - Enable Web3/MetaMask
- `?web3DappName=YourApp` - Set Web3 app name
- `?diagnostics=true` - Show diagnostics UI

## Global API

The template exposes a global `window.UnityWebGLApp` object:

```javascript
// Unity instance
window.UnityWebGLApp.myGameInstance

// Utilities
window.UnityWebGLApp.isMobile
window.UnityWebGLApp.getSystemInfo()
window.UnityWebGLApp.getDeviceName()
window.UnityWebGLApp.getBrowserName()

// Unity methods
window.UnityWebGLApp.showBuild()
window.UnityWebGLApp.isUserAuthorized()

// Analytics
window.UnityWebGLApp.sendEvent(eventName, props, userProps)
window.UnityWebGLApp.getSavedClientId()

// Xsolla
window.UnityWebGLApp.openXsollaPayStation(token)
window.UnityWebGLApp.openMetaframeLogin()
window.UnityWebGLApp.isAuthorized()

// Audio
window.UnityWebGLApp.AudioPlayer

// Web3
window.UnityWebGLApp.web3Connect()
window.UnityWebGLApp.web3IsConnected()

// Logging
window.UnityWebGLApp.Log
```

## Bootstrap Stages

The template uses a staged initialization system:

1. `init_logger` - Initialize logging system
2. `dom_refs` - Get DOM references
3. `is_mobile_flag` - Detect mobile devices
4. `expose_basics` - Expose basic API
5. `splash` - Initialize splash screen
6. `firebase_logs` - Initialize Firebase logging
7. `amplitude_init` - Initialize Amplitude analytics
8. `analytics_init` - Initialize Google Analytics
9. `focus_tracker` - Initialize focus tracking
10. `seo_indexer` - Apply SEO rules
11. `helper_init` - Initialize helper functions
12. `web3_metamask` - Initialize Web3/MetaMask (if enabled)
13. `web3_login_button` - Initialize Web3 login button (if enabled)
14. `audio_init` - Initialize audio controller
15. `video_init` - Initialize video controller (if enabled)
16. `diagnostics_init` - Initialize diagnostics UI (if enabled)
17. `xsolla_parallel` - Initialize Xsolla PayStation and Metaframe
18. `expose_runtime` - Expose runtime API
19. Unity loader initialization

## Adding Custom Features

### Adding a New Module

1. Create `src/mymodule.module.js`:

```javascript
export function initMyModule() {
  console.log("My module initialized");
}

export function doSomething() {
  // Your functionality
}
```

2. Import and initialize in `bootstrapper.module.js`:

```javascript
import { initMyModule } from "./mymodule.module.js?v={{{ PRODUCT_VERSION }}}";

async function taskMyModule() {
  const myModuleStage = EventTracker.trackStage(Events.BOOTSTRAP_MY_MODULE);
  try {
    initMyModule();
    myModuleStage.success();
  } catch (e) {
    myModuleStage.error(e);
    throw e;
  }
}

// Register in createBootstrapStages()
StageProgress.registerTask("my_module", taskMyModule);
```

3. Expose API in `taskExposeRuntime()`:

```javascript
extendUnityWebGLApp({
  myModuleApi: myModule,
});
```

## Dependencies

This template uses:
- Firebase SDK (loaded dynamically)
- Google Analytics (gtag.js)
- Xsolla SDKs (loaded dynamically)
- MetaMask SDK (loaded dynamically)
- Native ES6 modules (no build step required)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Notes

- **API Keys**: All API keys are removed and replaced with placeholders. You must add your own.
- **CORS**: Ensure your API endpoints have proper CORS configuration
- **HTTPS**: Use HTTPS in production for all external API calls
- **Tokens**: OAuth tokens are handled securely via callbacks

## Differences from Minimal Template

This full template includes everything from the minimal template plus:

- Analytics integration (Amplitude, Google Analytics)
- Firebase authentication and logging
- Xsolla payment integration
- Web3/MetaMask support
- Video streaming controller
- Advanced UI components
- OAuth flows
- Discord integration
- Comprehensive error tracking
- SEO optimization
- Mobile-specific handling

## Assets

### Required Assets

The template requires the following assets in `TemplateData/`:

- `favicon.ico` - Browser favicon
- `progress-bar-empty-dark.png` - Empty progress bar image
- `progress-bar-full-dark.png` - Full progress bar image
- `diagnostics/` folder - Unity diagnostics tool files:
  - `diagnostics.css` - Diagnostics UI styles
  - `diagnostics.js` - Diagnostics logic module
  - `webmemd-icon.png` - Diagnostics icon

### Mobile Error Assets (Optional)

**Note**: The `TemplateData/mobile_error/` folder has been removed from this template. If you need mobile error pages, you can:

1. Create your own mobile error page HTML/CSS/images
2. Update the `loadMobileContent()` function in `src/unity.module.js` to point to your custom mobile error page
3. Or remove mobile error handling entirely if not needed

The mobile error functionality is still present in the code but requires custom assets to function properly.

## License

This template is provided as-is for use in Unity WebGL projects.

## Migration from MegaMod/OnlySpace

If you're migrating from a previous version:

1. Replace all references to `window.MegaMod` with `window.UnityWebGLApp`
2. Update configuration in `config.module.js` with your credentials
3. Replace asset URLs with your own
4. Update cookie prefixes in `cookies_constants.module.js`
5. Update domain references in `sitemap.xml` and `robots.txt`
