import {
  CONTENT_IGNORE_ATTRIBUTE,
  CONTENT_UI_ATTRIBUTE,
} from "../../shared/config";

const PROMPT_NAME = "japanese-detection-prompt";

export interface DetectionPrompt {
  dismiss(): void;
}

export interface DetectionPromptActions {
  romanize(): Promise<boolean>;
  dismiss(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  name: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const created = document.createElement(name);
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

export function showJapaneseDetectionPrompt(
  document: Document,
  actions: DetectionPromptActions,
): DetectionPrompt {
  document
    .querySelector(`[${CONTENT_UI_ATTRIBUTE}="${PROMPT_NAME}"]`)
    ?.remove();

  const host = element(document, "div");
  host.setAttribute(CONTENT_IGNORE_ATTRIBUTE, "");
  host.setAttribute(CONTENT_UI_ATTRIBUTE, PROMPT_NAME);
  const shadow = host.attachShadow({ mode: "open" });
  const style = element(document, "style");
  style.textContent = `
    :host { all: initial; color-scheme: light dark; }
    section { position: fixed; z-index: 2147483647; top: 16px; right: 16px;
      width: min(320px, calc(100vw - 32px)); box-sizing: border-box;
      border: 1px solid #d0d5dd; border-radius: 10px; padding: 16px;
      color: #182230; background: #fff; box-shadow: 0 8px 24px rgba(16,24,40,.16);
      font: 14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
      animation: btb-enter 160ms ease-out; }
    h2 { margin: 0 36px 4px 0; font-size: 16px; line-height: 1.35; }
    p { margin: 0; color: #475467; }
    .actions { display: flex; gap: 8px; margin-top: 14px; }
    button { min-height: 40px; box-sizing: border-box; border: 1px solid #d0d5dd;
      border-radius: 8px; padding: 8px 12px; color: #182230; background: #fff;
      font: inherit; font-weight: 600; cursor: pointer; }
    button[data-primary] { border-color: #2f56d3; color: #fff; background: #2f56d3; }
    button[data-close] { position: absolute; top: 8px; right: 8px; width: 40px;
      padding: 0; border-color: transparent; font-size: 20px; }
    button:focus-visible { outline: 3px solid #1570ef; outline-offset: 2px; }
    button:disabled { cursor: wait; opacity: .65; }
    [role=status] { min-height: 18px; margin-top: 8px; font-size: 12px; font-weight: 600; }
    [data-error=true] { color: #b42318; }
    @keyframes btb-enter { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-color-scheme: dark) { section { border-color: #344054; color: #f2f4f7;
      background: #111827; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
      p { color: #b3bdc9; } button { border-color: #475467; color: #f2f4f7; background: #1f2937; }
      button[data-primary] { border-color: #91a7ff; color: #101828; background: #91a7ff; }
      button:focus-visible { outline-color: #84caff; } [data-error=true] { color: #fda29b; } }
    @media (prefers-reduced-motion: reduce) { section { animation: none; } }
    @media (forced-colors: active) { section, button { border: 1px solid CanvasText; }
      button[data-primary] { color: ButtonText; background: ButtonFace; } }
  `;
  const region = element(document, "section");
  region.setAttribute("aria-label", "Japanese detected");
  const title = element(document, "h2", "Japanese detected");
  const description = element(
    document,
    "p",
    "Romanize this page while keeping the language Japanese?",
  );
  const controls = element(document, "div");
  controls.className = "actions";
  const romanize = element(document, "button", "Romanize");
  romanize.type = "button";
  romanize.dataset.primary = "";
  const notNow = element(document, "button", "Not now");
  notNow.type = "button";
  const close = element(document, "button", "×");
  close.type = "button";
  close.dataset.close = "";
  close.setAttribute("aria-label", "Close Japanese detection prompt");
  const status = element(document, "p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const dismiss = (): void => {
    host.remove();
    actions.dismiss();
  };
  romanize.addEventListener("click", () => {
    romanize.disabled = true;
    notNow.disabled = true;
    status.textContent = "Preparing Japanese readings…";
    void actions
      .romanize()
      .then((started) => {
        if (started) {
          host.remove();
          return;
        }
        romanize.disabled = false;
        notNow.disabled = false;
        status.textContent = "Readings are unavailable. Try again.";
        status.dataset.error = "true";
      })
      .catch(() => {
        romanize.disabled = false;
        notNow.disabled = false;
        status.textContent = "Readings are unavailable. Try again.";
        status.dataset.error = "true";
      });
  });
  notNow.addEventListener("click", dismiss);
  close.addEventListener("click", dismiss);
  shadow.addEventListener("keydown", (event) => {
    if (event instanceof KeyboardEvent && event.key === "Escape") {
      event.preventDefault();
      dismiss();
    }
  });

  controls.append(romanize, notNow);
  region.append(title, description, controls, close, status);
  shadow.append(style, region);
  document.documentElement.append(host);
  return { dismiss };
}
