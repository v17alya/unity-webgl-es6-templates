// Draggable.js
export default class Draggable {
  /**
   * @param {HTMLElement} element - The element to be made draggable and resizable.
   */
  constructor(element) {
    this.element = element;
    // Initialize dragging with fixed positioning.
    this.initDrag();
    // Initialize resizing functionality.
    this.initResize();
    // Listen for window resize events to update element position.
    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  // Method to clamp the element's position within the viewport.
  clampPosition() {
    const el = this.element;
    const margin = document.fullscreenElement ? 0 : 10;
    const availWidth = document.fullscreenElement
      ? document.fullscreenElement.clientWidth
      : window.innerWidth;
    const availHeight = document.fullscreenElement
      ? document.fullscreenElement.clientHeight
      : window.innerHeight;
    const elemWidth = el.offsetWidth;
    const elemHeight = el.offsetHeight;
    let currentLeft =
      parseFloat(el.style.left) || el.getBoundingClientRect().left;
    let currentTop = parseFloat(el.style.top) || el.getBoundingClientRect().top;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const newLeft = clamp(currentLeft, margin, availWidth - margin - elemWidth);
    const newTop = clamp(currentTop, margin, availHeight - margin - elemHeight);
    el.style.left = `${newLeft}px`;
    el.style.top = `${newTop}px`;
  }

  initDrag() {
    const el = this.element;
    let active = false;
    let startX = 0,
      startY = 0;
    let startLeft = 0,
      startTop = 0;
    const defaultMargin = 10; // Default margin (in pixels) in non-fullscreen mode

    // Returns margin based on fullscreen status (if fullscreen, margin = 0)
    const getMargin = () => (document.fullscreenElement ? 0 : defaultMargin);

    // Clamp value between min and max.
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // Get available width (taking fullscreen into account).
    const getAvailableWidth = () =>
      document.fullscreenElement
        ? document.fullscreenElement.clientWidth
        : window.innerWidth;

    // Get available height (taking fullscreen into account).
    const getAvailableHeight = () =>
      document.fullscreenElement
        ? document.fullscreenElement.clientHeight
        : window.innerHeight;

    // Handler for drag start: store initial pointer coordinates and element position.
    const onDragStart = (clientX, clientY) => {
      active = true;
      startX = clientX;
      startY = clientY;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      // Ensure fixed positioning for accurate dragging.
      el.style.position = "fixed";
      el.style.left = `${startLeft}px`;
      el.style.top = `${startTop}px`;
    };

    // Handler for dragging: calculate new left/top, clamp within available bounds, and update styles.
    const onDrag = (clientX, clientY) => {
      if (!active) return;
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      const margin = getMargin();
      const availWidth = getAvailableWidth();
      const availHeight = getAvailableHeight();
      const elemWidth = el.offsetWidth;
      const elemHeight = el.offsetHeight;

      newLeft = clamp(newLeft, margin, availWidth - margin - elemWidth);
      newTop = clamp(newTop, margin, availHeight - margin - elemHeight);

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
    };

    // Handler for drag end: finalize position.
    const onDragEnd = (clientX, clientY) => {
      if (!active) return;
      onDrag(clientX, clientY);
      active = false;
    };

    // Attach mouse events.
    el.addEventListener(
      "mousedown",
      (e) => {
        // if (e.target !== el) return;
        onDragStart(e.clientX, e.clientY);
      },
      false
    );
    document.addEventListener(
      "mousemove",
      (e) => onDrag(e.clientX, e.clientY),
      false
    );
    document.addEventListener(
      "mouseup",
      (e) => onDragEnd(e.clientX, e.clientY),
      false
    );

    // Attach touch events.
    el.addEventListener(
      "touchstart",
      (e) => {
        // if (e.target !== el) return;
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      },
      false
    );
    document.addEventListener(
      "touchmove",
      (e) => onDrag(e.touches[0].clientX, e.touches[0].clientY),
      false
    );
    document.addEventListener(
      "touchend",
      (e) => {
        const clientX =
          e.changedTouches && e.changedTouches.length
            ? e.changedTouches[0].clientX
            : startX;
        const clientY =
          e.changedTouches && e.changedTouches.length
            ? e.changedTouches[0].clientY
            : startY;
        onDragEnd(clientX, clientY);
      },
      false
    );
  }

  initResize() {
    // Create the resizer element.
    const resizer = document.createElement("div");
    resizer.style.width = "20px";
    resizer.style.height = "20px";
    // Transparent background to let the icon be visible.
    resizer.style.background = "transparent";
    resizer.style.position = "absolute";
    resizer.style.right = "0";
    resizer.style.bottom = "0";
    resizer.style.cursor = "nwse-resize";
    resizer.style.display = "flex";
    resizer.style.alignItems = "center";
    resizer.style.justifyContent = "center";
    resizer.style.zIndex = 1101;
    resizer.style.pointerEvents = "all";

    // Add a small SVG icon to the resizer.
    resizer.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="gray" d="M7 17L17 7V12H22V22H12V17H7Z"/>
      </svg>
    `;

    // Append the resizer to the element.
    this.element.appendChild(resizer);

    // Define aspect ratio (16:9) and limits (in vw units).
    const aspectRatio = 16 / 9;
    const minWidthVW = 20; // Minimum width in vw
    const maxWidthVW = 80; // Maximum width in vw

    // Variables to store initial values.
    let resizing = false;
    let startX = 0;
    let startWidthVW = 0;
    const self = this;

    // Handler for resize start: record pointer position and element width (in vw).
    const onResizeStart = (clientX) => {
      resizing = true;
      startX = clientX;
      // Convert the element's current width (pixels) to vw.
      startWidthVW = (self.element.offsetWidth / window.innerWidth) * 100;
    };

    // Handler for resizing: calculate new width based on horizontal pointer movement.
    const onResizing = (clientX) => {
      if (!resizing) return;
      const deltaX = clientX - startX;
      // Convert deltaX from pixels to vw.
      const deltaX_vw = (deltaX / window.innerWidth) * 100;
      let newWidthVW = startWidthVW + deltaX_vw;
      // Clamp the new width between min and max (in vw).
      newWidthVW = Math.max(minWidthVW, Math.min(newWidthVW, maxWidthVW));
      // Update width and calculate height to maintain 16:9 aspect ratio.
      self.element.style.width = `${newWidthVW}vw`;
      self.element.style.height = `${(newWidthVW * 9) / 16}vw`;
      // Continuously clamp the element's position during resizing.
      self.clampPosition();

      self.element.dispatchEvent(
        new CustomEvent("playerSizeChanged", {
          detail: {
            width: self.element.offsetWidth,
            height: self.element.offsetHeight,
          },
        })
      );
    };

    // Handler for resize end: stop resizing.
    const onResizeEnd = () => {
      resizing = false;
      // Final clamp to ensure element remains within the viewport.
      self.clampPosition();

      self.element.dispatchEvent(
        new CustomEvent("playerSizeChanged", {
          detail: {
            width: self.element.offsetWidth,
            height: self.element.offsetHeight,
          },
        })
      );
    };

    // Mouse event handling.
    resizer.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      onResizeStart(e.clientX);
      document.addEventListener("mousemove", mousemoveHandler);
      document.addEventListener("mouseup", mouseupHandler);
    });

    const mousemoveHandler = (e) => {
      onResizing(e.clientX);
    };

    const mouseupHandler = () => {
      onResizeEnd();
      document.removeEventListener("mousemove", mousemoveHandler);
      document.removeEventListener("mouseup", mouseupHandler);
    };

    // Touch event handling.
    resizer.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      if (e.touches.length > 0) {
        onResizeStart(e.touches[0].clientX);
      }
      document.addEventListener("touchmove", touchmoveHandler);
      document.addEventListener("touchend", touchendHandler);
    });

    const touchmoveHandler = (e) => {
      if (e.touches.length > 0) {
        onResizing(e.touches[0].clientX);
      }
    };

    const touchendHandler = () => {
      onResizeEnd();
      document.removeEventListener("touchmove", touchmoveHandler);
      document.removeEventListener("touchend", touchendHandler);
    };
  }

  /**
   * Handler for window resize events.
   * Recalculates the element's position and clamps it within the new window bounds.
   */
  onWindowResize() {
    this.clampPosition();
  }
}
