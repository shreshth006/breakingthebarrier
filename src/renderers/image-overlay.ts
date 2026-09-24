import { CONTENT_IGNORE_ATTRIBUTE } from "../shared/config";

const IMAGE_OVERLAY_CLASS = "btb-image-overlay-badge";
const IMAGE_OVERLAY_STYLE_ID = "btb-image-overlay-style";

function ensureImageOverlayStyle(doc: Document): void {
  if (doc.getElementById(IMAGE_OVERLAY_STYLE_ID) !== null) {
    return;
  }
  const style = doc.createElement("style");
  style.id = IMAGE_OVERLAY_STYLE_ID;
  style.textContent = `
    div.${IMAGE_OVERLAY_CLASS} {
      display: inline-block !important;
      box-sizing: border-box !important;
      margin: 4px 0 !important;
      padding: 4px 8px !important;
      border: 1px solid rgba(226, 232, 240, 0.3) !important;
      border-radius: 6px !important;
      background: rgba(15, 23, 42, 0.88) !important;
      color: #ffffff !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.35 !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
      backdrop-filter: blur(4px) !important;
      vertical-align: middle !important;
    }
    div.${IMAGE_OVERLAY_CLASS} span.btb-img-orig {
      font-size: 11px !important;
      color: #94a3b8 !important;
    }
    div.${IMAGE_OVERLAY_CLASS} span.btb-img-rt {
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #e2e8f0 !important;
      letter-spacing: 0.01em !important;
    }
  `;
  doc.head.appendChild(style);
}

export interface ImageOverlayState {
  element: HTMLImageElement;
  originalAlt: string | null;
  originalTitle: string | null;
  overlayElement?: HTMLElement;
}

export function applyImageTransliteration(
  img: HTMLImageElement,
  sourceText: string,
  renderedText: string,
  mode: "annotation" | "replace",
): ImageOverlayState {
  const doc = img.ownerDocument;
  ensureImageOverlayStyle(doc);

  const state: ImageOverlayState = {
    element: img,
    originalAlt: img.getAttribute("alt"),
    originalTitle: img.getAttribute("title"),
  };

  if (state.originalAlt !== null) {
    const newAlt = mode === "annotation" ? `${state.originalAlt} (${renderedText})` : renderedText;
    img.setAttribute("alt", newAlt);
  }

  if (state.originalTitle !== null) {
    const newTitle = mode === "annotation" ? `${state.originalTitle} (${renderedText})` : renderedText;
    img.setAttribute("title", newTitle);
  }

  // Create visible overlay badge attached next to/below image
  const overlay = doc.createElement("div");
  overlay.className = IMAGE_OVERLAY_CLASS;
  overlay.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");

  const rtSpan = doc.createElement("span");
  rtSpan.className = "btb-img-rt";
  rtSpan.textContent = renderedText;
  overlay.appendChild(rtSpan);

  if (mode === "annotation" && sourceText !== renderedText) {
    const origSpan = doc.createElement("span");
    origSpan.className = "btb-img-orig";
    origSpan.textContent = ` (${sourceText})`;
    overlay.appendChild(origSpan);
  }

  const parent = img.parentNode;
  if (parent !== null) {
    if (img.nextSibling !== null) {
      parent.insertBefore(overlay, img.nextSibling);
    } else {
      parent.appendChild(overlay);
    }
    state.overlayElement = overlay;
  }

  return state;
}

export function restoreImageElement(state: ImageOverlayState): void {
  if (state.originalAlt !== null) {
    state.element.setAttribute("alt", state.originalAlt);
  }
  if (state.originalTitle !== null) {
    state.element.setAttribute("title", state.originalTitle);
  }

  state.overlayElement?.remove();
}

