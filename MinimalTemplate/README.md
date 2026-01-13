# Minimal Unity WebGL Template

A minimal, modular ES6-based Unity WebGL template that provides the essential functionality for loading and running Unity builds in a browser.

## Features

- ✅ **ES6 Modules**: Clean, modular architecture using native JavaScript modules
- ✅ **Minimal Dependencies**: No external libraries required (pure vanilla JS)
- ✅ **Progress Tracking**: Bootstrap and Unity load progress visualization
- ✅ **Error Handling**: Global error handler with WebGL diagnostics
- ✅ **Configuration**: Centralized config module with URL parameter override support
- ✅ **Logging**: Structured logging with configurable log levels
- ✅ **Mobile Detection**: Automatic mobile device detection and handling
- ✅ **Unity Integration**: Proper Unity instance creation and lifecycle management

## Structure

```
MinimalTemplate/
├── index.html                 # Main HTML file
├── src/                       # JavaScript modules
│   ├── bootstrapper.module.js    # Main bootstrap orchestrator
│   ├── config.module.js          # Centralized configuration
│   ├── logger.module.js          # Logging system
│   ├── errorHandler.module.js    # Global error handling
│   ├── unity.module.js           # Unity loader integration
│   ├── progress_ui.module.js     # Progress bar UI
│   ├── helpers.module.js         # Utility functions
│   ├── modulepath.bootstrap.js   # Module path setup
│   └── app_version.js            # Version string
├── TemplateData/
│   ├── css/
│   │   └── style.css             # Minimal styling
│   ├── diagnostics/              # Unity diagnostics tool
│   │   ├── diagnostics.css      # Diagnostics UI styles
│   │   ├── diagnostics.js       # Diagnostics logic
│   │   └── webmemd-icon.png     # Diagnostics icon
│   ├── progress-bar-empty-dark.png # Progress bar empty state
│   ├── progress-bar-full-dark.png  # Progress bar full state
│   └── favicon.ico               # Favicon (add your own)
└── README.md
```

## Quick Start

1. **Copy the template** to your Unity project's `Assets/WebGLTemplates/` folder
2. **Update configuration** in `src/config.module.js` if needed
3. **Customize styling** in `TemplateData/css/style.css`
4. **Build your Unity project** for WebGL using this template

## Configuration

Configuration is handled in `src/config.module.js`. You can override settings via URL query parameters:

- `?debug=true` - Enable debug mode
- `?logLevel=0` - Set log level (0=All, 1=Info, 2=Warning, 3=Error, 4=Exception, 5=None)
- `?production=false` - Override production detection
- `?diagnostics=true` - Enable Unity diagnostics tool (memory monitoring)

### Example

```javascript
// In config.module.js
function detectProduction() {
  const url = self.location.href;
  // Customize based on your deployment URLs
  return !url.includes("localhost") && !url.includes("dev");
}
```

## Usage from Unity

The template exposes a global `window.GameTemplate` object that Unity can access:

```javascript
// Unity can call:
window.GameTemplate.showBuild()      // Hide loader, show Unity canvas
window.GameTemplate.isMobile         // Boolean flag
window.GameTemplate.getSystemInfo()  // Get browser/device info
window.GameTemplate.Log              // Access logger
```

## Unity Build Settings

When building from Unity, the template uses these Unity template variables (automatically replaced by Unity during build):

### Basic Variables
- `{{{ PRODUCT_NAME }}}` - Product Name from Player Settings
- `{{{ PRODUCT_VERSION }}}` - Version from Player Settings
- `{{{ COMPANY_NAME }}}` - Company Name from Player Settings
- `{{{ WIDTH }}}` / `{{{ HEIGHT }}}` - Default Canvas Width/Height from Player Settings
- `{{{ BACKGROUND_COLOR }}}` - Background Color (hex triplet format)
- `{{{ SPLASH_SCREEN_STYLE }}}` - "Dark" or "Light" based on Splash Image settings

### Build Files
- `{{{ LOADER_FILENAME }}}` - Filename of the build loader script
- `{{{ DATA_FILENAME }}}` - Filename of the main data file
- `{{{ FRAMEWORK_FILENAME }}}` - Filename of the build framework script
- `{{{ CODE_FILENAME }}}` - Filename of WebAssembly module (WASM builds) or asm.js module
- `{{{ MEMORY_FILENAME }}}` - Filename of memory file (if external, empty otherwise)
- `{{{ SYMBOLS_FILENAME }}}` - Filename of JSON debug symbols file (if enabled, empty otherwise)
- `{{{ WORKER_FILENAME }}}` - Filename of worker file (if threads enabled)

### Build Flags
- `USE_WASM` - True if WebAssembly build
- `USE_THREADS` - True if threads enabled
- `USE_WEBGL_1_0` / `USE_WEBGL_2_0` - Graphics API support flags
- `MEMORY_FILENAME` - Conditional flag for external memory file
- `SYMBOLS_FILENAME` - Conditional flag for debug symbols

All these variables are automatically replaced by Unity during the build process. You don't need to manually set them.

## Customization

### Adding Custom Modules

You can extend the template by adding new modules:

1. Create a new `.module.js` file in `src/`
2. Import it in `bootstrapper.module.js`
3. Add initialization logic in the bootstrap stages

Example:

```javascript
// src/myfeature.module.js
export function initMyFeature() {
  console.log("My feature initialized");
}

// In bootstrapper.module.js
import { initMyFeature } from "./myfeature.module.js?v={{{ PRODUCT_VERSION }}}";

async function taskMyFeature() {
  initMyFeature();
  setBootstrapProgress(0.9);
}
```

### Styling

Edit `TemplateData/css/style.css` to customize:
- Loading screen appearance
- Progress bar styling
- Colors and fonts
- Responsive breakpoints

## Logging

The template includes a structured logging system with configurable levels:

```javascript
import { Log } from "./logger.module.js";

Log.debug("Debug message");
Log.info("Info message");
Log.warn("Warning message");
Log.error("Error message");
Log.exception("Exception", error);
```

Set log level via URL: `?logLevel=2` (0=All, 5=None)

## Error Handling

Global error handler automatically catches:
- JavaScript errors
- Unhandled promise rejections
- WebGL context loss
- Unity loader failures

Errors are logged with context including:
- User agent and platform info
- WebGL capabilities
- Memory usage
- Screen dimensions

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

This template is provided as-is for use in Unity WebGL projects.

## Differences from Full Template

This minimal template includes only:
- Core Unity loading functionality
- Basic progress tracking
- Error handling
- Logging system
- Mobile detection

The full template (`SampleTemplate`) includes additional features like:
- Analytics integration (Amplitude, Google Analytics)
- Firebase authentication and logging
- Xsolla payment integration
- Web3/MetaMask support
- Video streaming controller
- Advanced UI components
- OAuth flows
- And more...

Use this minimal template as a starting point and add features as needed, or use the full template if you need those features out of the box.
