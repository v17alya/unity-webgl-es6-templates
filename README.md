# Unity WebGL Templates - Modular ES6 Architecture

A collection of Unity WebGL templates using modern ES6 module architecture. This repository contains two templates: a minimal starter template and a full-featured production template.

## Overview

These templates demonstrate a modular approach to Unity WebGL development using native ES6 JavaScript modules, avoiding build steps and maintaining clean, maintainable code structure.

## Templates

### 1. MinimalTemplate

**Path**: `MinimalTemplate/`

A minimal, lightweight template with essential features for loading and running Unity builds. Perfect for:
- Learning the modular architecture
- Simple projects without external integrations
- Quick prototyping
- Starting point for custom solutions

**Features**:
- ES6 module architecture
- Basic Unity loader integration
- Progress tracking
- Error handling
- Logging system
- Mobile detection
- Configuration via URL parameters

**See**: [MinimalTemplate/README.md](./MinimalTemplate/README.md) for detailed documentation.

### 2. SampleTemplate (Full Template)

**Path**: `SampleTemplate/`

A comprehensive, production-ready template with extensive features for analytics, authentication, payments, and more. Suitable for:
- Production games and applications
- Projects requiring analytics
- Payment processing needs
- Web3/blockchain integration
- Complex authentication flows

**Features**:
- Everything from MinimalTemplate
- Analytics (Amplitude, Google Analytics)
- Firebase (Auth, Logging)
- Payment processing (Xsolla)
- Web3/MetaMask integration
- Video streaming
- Advanced UI components
- OAuth flows
- Discord integration
- SEO optimization

**See**: [SampleTemplate/README.md](./SampleTemplate/README.md) for detailed documentation.

## Architecture

Both templates follow the same modular architecture principles:

### ES6 Modules

All JavaScript code is organized as ES6 modules, loaded dynamically:

```javascript
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
```

### Centralized Configuration

Configuration is centralized in `config.module.js` and can be overridden via URL parameters:

```javascript
// In config.module.js
const IS_PRODUCTION = detectProduction();
const DEBUG = getQueryParamBool("debug") ?? !IS_PRODUCTION;

// Via URL: ?debug=true&logLevel=0
```

### Staged Bootstrap

Initialization happens in stages for reliability and progress tracking:

```javascript
StageProgress.registerTask("init_logger", taskInitLogger);
StageProgress.registerTask("unity_loader", taskUnityLoader);
// ... more stages
```

### Global API

Both templates expose a global namespace for Unity access:

- MinimalTemplate: `window.GameTemplate`
- SampleTemplate: `window.UnityWebGLApp`

## Quick Start

### Using MinimalTemplate

1. Copy `MinimalTemplate/` to `Assets/WebGLTemplates/MinimalTemplate/` in your Unity project
2. Configure settings in `src/config.module.js` if needed
3. Build your Unity project for WebGL using this template
4. Deploy and test

### Using SampleTemplate

1. Copy `SampleTemplate/` to `Assets/WebGLTemplates/SampleTemplate/` in your Unity project
2. **Configure all API keys and credentials** in `src/config.module.js`:
   - Firebase credentials
   - Google Analytics ID
   - Xsolla configuration
   - Analytics endpoint
   - Asset URLs
3. Update cookie prefix in `src/cookies_constants.module.js`
4. Update domain references in `sitemap.xml` and `robots.txt`
5. Build your Unity project for WebGL using this template
6. Deploy and test

## Key Concepts

### Module Versioning

Modules use version query parameters for cache busting:

```javascript
import { Log } from "./logger.module.js?v={{{ PRODUCT_VERSION }}}";
```

Unity replaces `{{{ PRODUCT_VERSION }}}` with the actual version during build.

### Progress Tracking

Progress is tracked across multiple stages:

```javascript
// Bootstrap progress (0-50%)
setBootstrapProgress(0.5);

// Unity load progress (50-90%)
setUnityBuildLoadProgress(0.8);

// Unity boot progress (90-100%)
setUnityBuildBootProgress(1.0);
```

### Error Handling

Global error handler catches all JavaScript errors:

```javascript
window.addEventListener("error", (e) => {
  ErrorHandler.logError("Error occurred", {}, e);
});
```

### Logging

Structured logging with configurable levels:

```javascript
Log.debug("Debug message");
Log.info("Info message");
Log.warn("Warning message");
Log.error("Error message");
```

## Configuration Reference

### URL Parameters

Both templates support configuration via URL parameters:

- `?debug=true` - Enable debug mode
- `?logLevel=0` - Set log level (0=All, 1=Info, 2=Warning, 3=Error, 4=Exception, 5=None)
- `?production=false` - Override production detection

SampleTemplate template also supports:
- `?web3Enabled=true` - Enable Web3/MetaMask
- `?diagnostics=true` - Show diagnostics UI
- `?videoStreamingEnabled=true` - Enable video streaming

### Environment Detection

Production mode is detected automatically based on URL:

```javascript
function detectProduction() {
  const url = self.location.href;
  return !url.includes("localhost") && !url.includes("127.0.0.1") && !url.includes("dev");
}
```

## Customization

### Adding Custom Modules

1. Create a new module file: `src/mymodule.module.js`
2. Export your functions/classes
3. Import and initialize in `bootstrapper.module.js`
4. Register as a bootstrap stage
5. Expose API in `taskExposeRuntime()`

### Customizing Styling

Edit `TemplateData/css/style.css` in either template to customize:
- Loading screen appearance
- Progress bar styling
- Colors and fonts
- Responsive breakpoints

### Custom Unity Integration

Unity can access the global API:

```csharp
// In Unity C#
Application.ExternalCall("UnityWebGLApp.showBuild");
Application.ExternalEval("window.UnityWebGLApp.sendEvent('MyEvent', {key: 'value'});");
```

## Best Practices

1. **Always version your modules** - Use `?v={{{ PRODUCT_VERSION }}}` for cache busting
2. **Handle errors gracefully** - Use try-catch blocks and log errors
3. **Track initialization stages** - Use the stage progress system
4. **Separate concerns** - Keep modules focused on single responsibilities
5. **Document configuration** - Comment all configurable values
6. **Test in production mode** - Ensure production detection works correctly
7. **Secure API keys** - Never commit real API keys, use placeholders
8. **Monitor errors** - Use error handlers to track issues in production

## Browser Compatibility

Both templates support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

ES6 modules are natively supported in all modern browsers.

## Contributing

When contributing:
1. Maintain ES6 module structure
2. Follow existing code style
3. Add JSDoc comments for public APIs
4. Test in both minimal and full templates
5. Update relevant README files

## License

These templates are provided as-is for use in Unity WebGL projects.

## Migration Guide

### From Traditional Templates

If migrating from a traditional Unity WebGL template:

1. **Replace global namespace** - Traditional templates often use global functions. These templates use modules.
2. **Update Unity calls** - Use the global API object instead of direct function calls
3. **Move configuration** - Centralize config in `config.module.js`
4. **Update HTML** - The HTML structure may differ, check the template files

### From MegaMod/OnlySpace

If migrating from a previous version of these templates:

1. **Namespace change** - `window.MegaMod` → `window.UnityWebGLApp`
2. **Configuration** - All API keys removed, add your own
3. **Asset URLs** - Replace placeholder URLs with your own
4. **Domain references** - Update in `sitemap.xml` and `robots.txt`

## Assets

### MinimalTemplate Assets

The minimal template includes:
- `favicon.ico` - Browser favicon
- `progress-bar-empty-dark.png` / `progress-bar-full-dark.png` - Progress bar images
- `diagnostics/` folder - Unity diagnostics tool (optional, enabled via `?diagnostics=true`)

### SampleTemplate Assets

The full template includes all assets from MinimalTemplate plus:
- Additional UI assets in `TemplateData/`
- Video controller assets
- **Note**: The `TemplateData/mobile_error/` folder has been removed. Mobile error pages require custom implementation if needed.

## Support

For issues, questions, or contributions, please refer to the individual template README files or create an issue in the repository.
