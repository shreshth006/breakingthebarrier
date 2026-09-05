import {
  createPageCommandRequest,
  createSitePolicyRequest,
} from "../../shared/messages";
import type { FrameSessionSummary, PageCommand } from "../../shared/messages";
import {
  validateHealthErrorResponse,
  validatePageCommandResponse,
  validateSitePolicyResponse,
} from "../../shared/validation";
import { popupViewForSummary } from "./popup-view";
import {
  getCurrentSite,
  removeSitePermission,
  requestSitePermission,
} from "../../platform/site-access";
import type { CurrentSite } from "../../platform/site-access";
import { PreferenceStore } from "../../storage/preferences";
import type { SitePolicy } from "../../storage/schema";
import { changeRememberedSite } from "./remember-site";

const buttonElement = document.querySelector("#page-action");
const statusElement = document.querySelector("#status");
const badgeElement = document.querySelector("#page-state");
const siteMemoryElement = document.querySelector("#site-memory");
const rememberElement = document.querySelector("#remember-site");
const siteHostElement = document.querySelector("#site-host");
const siteStatusElement = document.querySelector("#site-status");
const sitePolicyControlElement = document.querySelector("#site-policy-control");
const sitePolicyElement = document.querySelector("#site-policy");

if (
  !(buttonElement instanceof HTMLButtonElement) ||
  !(statusElement instanceof HTMLElement) ||
  !(badgeElement instanceof HTMLElement) ||
  !(siteMemoryElement instanceof HTMLElement) ||
  !(rememberElement instanceof HTMLInputElement) ||
  !(siteHostElement instanceof HTMLElement) ||
  !(siteStatusElement instanceof HTMLElement) ||
  !(sitePolicyControlElement instanceof HTMLElement) ||
  !(sitePolicyElement instanceof HTMLSelectElement)
) {
  throw new Error("Required popup controls are missing");
}

const actionButton = buttonElement;
const status = statusElement;
const badge = badgeElement;
const siteMemory = siteMemoryElement;
const rememberSite = rememberElement;
const siteHost = siteHostElement;
const siteStatus = siteStatusElement;
const sitePolicyControl = sitePolicyControlElement;
const sitePolicy = sitePolicyElement;
const preferenceStore = new PreferenceStore(chrome.storage.local);
let currentState: FrameSessionSummary["state"] = "original";
let currentSite: CurrentSite | null = null;
let currentSitePolicy: "ask" | "always" | undefined;

function setStatus(
  message: string,
  state: "idle" | "loading" | "success" | "error",
): void {
  status.textContent = message;
  status.dataset.state = state;
  delete status.dataset.errorCode;
  delete status.dataset.errorCause;
  actionButton.setAttribute(
    "aria-busy",
    state === "loading" ? "true" : "false",
  );
}

function setSiteStatus(
  message: string,
  state: "idle" | "loading" | "success" | "error",
): void {
  siteStatus.textContent = message;
  siteStatus.dataset.state = state;
}

function renderSummary(summary: FrameSessionSummary): void {
  currentState = summary.state;
  const view = popupViewForSummary(summary);
  badge.textContent = view.badge;
  badge.dataset.state = view.statusState;
  actionButton.textContent = view.actionLabel;
  actionButton.disabled = view.actionDisabled;
  setStatus(view.status, view.statusState);
}

async function sendCommand(command: PageCommand): Promise<void> {
  const requestId = crypto.randomUUID();
  const rawResponse: unknown = await chrome.runtime.sendMessage(
    createPageCommandRequest(requestId, command),
  );
  const response = validatePageCommandResponse(rawResponse);
  if (response.ok && response.value.requestId === requestId) {
    renderSummary(response.value);
    return;
  }
  const errorResponse = validateHealthErrorResponse(rawResponse);
  setStatus("Readings are unavailable. Try again.", "error");
  if (errorResponse.ok) {
    status.dataset.errorCode = errorResponse.value.error.code;
    status.dataset.errorCause = errorResponse.value.error.causeCategory;
  }
}

async function setRememberedSitePolicy(
  site: CurrentSite,
  policy: SitePolicy | null,
): Promise<boolean> {
  const requestId = crypto.randomUUID();
  const rawResponse: unknown = await chrome.runtime.sendMessage(
    createSitePolicyRequest(requestId, site.origin, policy),
  );
  const response = validateSitePolicyResponse(rawResponse);
  return (
    response.ok &&
    response.value.requestId === requestId &&
    response.value.origin === site.origin &&
    (policy === "ask" || policy === "always"
      ? response.value.permissionGranted && response.value.registered
      : response.value.policy === null)
  );
}

function renderSitePolicy(policy: SitePolicy | undefined): void {
  const remembered = policy === "ask" || policy === "always";
  currentSitePolicy = remembered ? policy : undefined;
  rememberSite.checked = remembered;
  sitePolicyControl.hidden = !remembered;
  sitePolicy.disabled = !remembered;
  sitePolicy.value = policy === "always" ? "always" : "ask";
}

async function loadSiteMemory(): Promise<void> {
  const site = await getCurrentSite();
  if (site === null) {
    return;
  }
  currentSite = site;
  siteHost.textContent = site.host;
  siteMemory.hidden = false;
  const preferences = await preferenceStore.get();
  const policy = preferences.sites[site.origin]?.policy;
  renderSitePolicy(policy);
  rememberSite.disabled = false;
  if (rememberSite.checked) {
    setSiteStatus("This site can be checked automatically.", "success");
  }
}

actionButton.addEventListener("click", () => {
  actionButton.disabled = true;
  const command = currentState === "active" ? "stop" : "start";
  setStatus(
    command === "start"
      ? "Preparing Japanese readings…"
      : "Restoring original text…",
    "loading",
  );
  badge.textContent = command === "start" ? "Starting" : "Original";
  badge.dataset.state = "loading";
  void sendCommand(command).catch(() => {
    actionButton.disabled = false;
    setStatus("Readings are unavailable. Try again.", "error");
  });
});

rememberSite.addEventListener("change", () => {
  const site = currentSite;
  if (site === null) {
    rememberSite.checked = false;
    return;
  }
  const shouldRemember = rememberSite.checked;
  rememberSite.disabled = true;
  setSiteStatus(
    shouldRemember ? "Waiting for site access…" : "Removing site access…",
    "loading",
  );
  void (async () => {
    const result = await changeRememberedSite(shouldRemember, {
      requestPermission: () => requestSitePermission(site.origin),
      savePolicy: (remember) =>
        setRememberedSitePolicy(site, remember ? "ask" : null),
      removePermission: () => removeSitePermission(site.origin),
      markExplanationSeen: async () => {
        await preferenceStore.patch({ sitePermissionExplained: true });
      },
    });
    if (result === "remembered") {
      renderSitePolicy("ask");
      setSiteStatus("This site can be checked automatically.", "success");
    } else if (result === "forgotten") {
      renderSitePolicy(undefined);
      setSiteStatus("This site will not be checked automatically.", "idle");
    } else {
      rememberSite.checked = result === "forget-failed";
      renderSitePolicy(
        result === "forget-failed" ? currentSitePolicy : undefined,
      );
      setSiteStatus(
        result === "permission-denied"
          ? "Site access was not granted."
          : result === "save-failed"
            ? "Site access could not be saved. Try again."
            : "Site access could not be removed. Try again.",
        "error",
      );
    }
  })()
    .catch(() => {
      rememberSite.checked = !shouldRemember;
      setSiteStatus("Site access is unavailable. Try again.", "error");
    })
    .finally(() => {
      rememberSite.disabled = false;
      sitePolicy.disabled = !rememberSite.checked;
    });
});

sitePolicy.addEventListener("change", () => {
  const site = currentSite;
  const nextPolicy: SitePolicy =
    sitePolicy.value === "always" ? "always" : "ask";
  const previousPolicy = currentSitePolicy ?? "ask";
  if (site === null || !rememberSite.checked) {
    sitePolicy.value = previousPolicy;
    return;
  }
  if (nextPolicy === previousPolicy) {
    return;
  }
  rememberSite.disabled = true;
  sitePolicy.disabled = true;
  setSiteStatus("Saving automatic behavior…", "loading");
  void setRememberedSitePolicy(site, nextPolicy)
    .then((saved) => {
      if (!saved) {
        renderSitePolicy(previousPolicy);
        setSiteStatus("Automatic behavior could not be saved. Try again.", "error");
        return;
      }
      renderSitePolicy(nextPolicy);
      setSiteStatus(
        nextPolicy === "always"
          ? "New pages on this site will romanize automatically."
          : "New pages on this site will ask before changing text.",
        "success",
      );
    })
    .catch(() => {
      renderSitePolicy(previousPolicy);
      setSiteStatus("Automatic behavior could not be saved. Try again.", "error");
    })
    .finally(() => {
      rememberSite.disabled = false;
      sitePolicy.disabled = false;
    });
});

void sendCommand("status").catch(() => {
  setStatus("Current page is original", "idle");
});
void loadSiteMemory().catch(() => {
  siteMemory.hidden = true;
});
