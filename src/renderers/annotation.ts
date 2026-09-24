import { CONTENT_IGNORE_ATTRIBUTE } from "../shared/config";
import type { NodeState } from "../content/node-state";
import type { TransliterationResult } from "../engines/contracts";
import type { Renderer } from "./contracts";

const RUBY_STYLE_ID = "btb-ruby-style";

function ensureRubyStyle(doc: Document): void {
  if (doc.getElementById(RUBY_STYLE_ID) !== null) {
    return;
  }
  const style = doc.createElement("style");
  style.id = RUBY_STYLE_ID;
  style.textContent = `
    ruby.btb-ruby-token {
      display: inline-ruby !important;
      ruby-position: over !important;
      ruby-align: center !important;
      line-height: normal !important;
    }
    rt.btb-ruby-rt {
      display: ruby-text !important;
      font-size: 0.68em !important;
      line-height: 1.1 !important;
      font-weight: 700 !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      color: #e2e8f0 !important;
      text-shadow: 0 0 2px rgba(0, 0, 0, 0.95), 0 1px 3px rgba(0, 0, 0, 0.8) !important;
      letter-spacing: 0.02em !important;
      user-select: none !important;
      pointer-events: none !important;
    }
  `;
  doc.head.appendChild(style);
}

export const annotationRenderer: Renderer = {
  id: "annotation-v1",
  apply(target: Text, result: TransliterationResult, state: NodeState): boolean {
    if (target.data !== state.source || result.source !== state.source) {
      return false;
    }

    const rendered = result.rendered.trim();
    if (rendered.length === 0 || rendered === state.source) {
      return false;
    }

    const doc = target.ownerDocument;
    const parent = target.parentNode;
    if (parent === null) {
      return false;
    }

    ensureRubyStyle(doc);

    const parentElem = parent as HTMLElement;
    if (
      parentElem.localName === "ruby" &&
      parentElem.classList.contains("btb-ruby-token")
    ) {
      const rt = parentElem.querySelector("rt.btb-ruby-rt");
      if (rt !== null) {
        rt.textContent = rendered;
      }
      state.rendered = state.source;
      state.status = "rendered";
      return true;
    }

    try {
      const container = doc.createElement("span");
      container.className = "btb-ruby-container";
      container.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");

      if (result.segments && result.segments.length > 0) {
        let lastIndex = 0;
        for (const seg of result.segments) {
          if (seg.start > lastIndex) {
            const gap = state.source.slice(lastIndex, seg.start);
            container.appendChild(doc.createTextNode(gap));
          }
          const reading = seg.romanized ?? seg.reading;
          const segText = seg.source;
          if (reading && reading !== segText && reading.trim().length > 0) {
            const ruby = doc.createElement("ruby");
            ruby.className = "btb-ruby-token";
            ruby.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");
            ruby.appendChild(doc.createTextNode(segText));

            const rt = doc.createElement("rt");
            rt.className = "btb-ruby-rt";
            rt.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");
            rt.textContent = reading;

            ruby.appendChild(rt);
            container.appendChild(ruby);
          } else {
            container.appendChild(doc.createTextNode(segText));
          }
          lastIndex = seg.end;
        }
        if (lastIndex < state.source.length) {
          container.appendChild(doc.createTextNode(state.source.slice(lastIndex)));
        }
      } else {
        const ruby = doc.createElement("ruby");
        ruby.className = "btb-ruby-token";
        ruby.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");
        ruby.appendChild(doc.createTextNode(state.source));

        const rt = doc.createElement("rt");
        rt.className = "btb-ruby-rt";
        rt.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");
        rt.textContent = rendered;

        ruby.appendChild(rt);
        container.appendChild(ruby);
      }

      parent.replaceChild(container, target);

      state.rendered = state.source;
      state.rendererId = "annotation-v1";
      state.status = "rendered";
      state.container = container;

      return true;
    } catch {
      const dualText = `${state.source} (${rendered})`;
      state.rendered = dualText;
      state.rendererId = "annotation-v1";
      state.status = "rendered";
      target.data = dualText;
      return true;
    }
  },
};




