// webgl_problems_overlay.module.js
// Module to create and display a WebGL support overlay

/**
 * Renders a full-screen overlay with instructions when WebGL support is missing or limited.
 * @param {boolean} isMobile - Flag indicating mobile device usage.
 */
export function showWebGLProblems(isMobile = false) {
  // Prevent duplicate overlay elements
  if (document.getElementById("webgl-problem-overlay")) return;

  // Inject CSS styles for backdrop, window, and responsive sizing
  const style = document.createElement("style");
  style.textContent = `
    /* Full-screen semi-transparent backdrop */
    #webgl-problem-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      // background: rgba(0, 0, 0, 0.6);
      z-index: 9999;
    }

    /* Centered content window */
    #webgl-problem-overlay .window {
      background: rgba(0, 0, 0, 0.9);
      width: calc(100% - 100px);
      height: calc(100% - 100px);
      padding: 20px;
      box-sizing: border-box;
      border-radius: 4px;
      box-shadow: 0 4px 80px rgba(0, 0, 0, 1);
      display: flex;
      flex-direction: column;
    }

    /* Header text styling */
    #webgl-problem-overlay .header {
      font-family: 'Inter', sans-serif;
      font-weight: 900;
      font-size: 48px;
      color: #fff;
    }

    /* Subheader text styling */
    #webgl-problem-overlay .subheader {
      font-family: 'Inter', sans-serif;
      font-weight: 100;
      font-size: 36px;
      color: #fff;
      margin-top: 12px;
    }

    /* Separator line */
    #webgl-problem-overlay .separator {
      width: 100%;
      border-top: 2px solid #fff;
      margin: 20px 0;
    }

    /* Body container: center content vertically & horizontally */
    #webgl-problem-overlay .body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Body text styling */
    #webgl-problem-overlay .body-content {
      width: 100%;
      box-sizing: border-box;
      text-align: center;
      color: #fff;
      font-size: 24px;
      line-height: 1.4;
      font-family: 'Inter', sans-serif;
      font-weight: 300;
    }

    /* Edge link styling (desktop only) */
    #webgl-problem-overlay .edge-link {
      color: #00C8FF;
      text-decoration: underline;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-weight: 300;
    }

    /* MOBILE: set window height to ~40% of viewport and bump font sizes */
    @media (max-width: 480px) {
      #webgl-problem-overlay .window {
        width: calc(100% - 20px);
        height: 50vh;
        padding: 16px;
      }
      #webgl-problem-overlay .header {
        font-size: 32px;
        text-align: center;
      }
      #webgl-problem-overlay .subheader {
        font-size: 24px;
        text-align: center;
      }
      #webgl-problem-overlay .body-content {
        font-size: 22px;
      }
    }
  `;
  document.head.appendChild(style);

  // Build the overlay DOM
  const overlay = document.createElement("div");
  overlay.id = "webgl-problem-overlay";
  overlay.innerHTML = `
    <div class="window">
      <div class="header">
        ${isMobile ? "YOU HAVE WEBGL PROBLEMS" : "YOU HAVE WEBGL PROBLEMS"}
      </div>
      <div class="subheader">
        ${
          isMobile
            ? "Try a different browser or use a PC."
            : "Enable app acceleration"
        }
      </div>
      <div class="separator"></div>
      <div class="body">
        <div class="body-content">
          ${
            isMobile
              ? "We detected that your device does not support WebGL. Please try another browser or switch to a desktop computer."
              : `Go to your browser settings, find the "Hardware acceleration" option, and enable it.<br><br>
               In Google Chrome: <b>Settings – Advanced – System – Use hardware acceleration</b><br><br>
               <b><span style="font-size:32px;">or:</span></b><br><br>
               <span class="edge-link" id="open-edge">open MS Edge</span><br><br>`
          }
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Attach click handler for the Edge link (desktop only)
  const edgeLink = overlay.querySelector("#open-edge");
  if (edgeLink) {
    edgeLink.addEventListener("click", () =>
      window.open("microsoft-edge:", "_blank")
    );
  }
}
