import { hasSupportedLanguageEvidence } from "../detector/language-evidence";
import { CONTENT_IGNORE_ATTRIBUTE } from "../shared/config";

export interface ImageTextTarget {
  readonly element: HTMLImageElement;
  readonly sourceText: string;
  readonly attributeType: "alt" | "title" | "aria-label";
}

export function collectEligibleImageElements(
  root: Document | Element,
): readonly ImageTextTarget[] {
  const images = root.querySelectorAll("img");
  const targets: ImageTextTarget[] = [];

  for (const img of images) {
    if (
      !img.isConnected ||
      img.hasAttribute(CONTENT_IGNORE_ATTRIBUTE) ||
      img.closest(`[${CONTENT_IGNORE_ATTRIBUTE}]`) !== null
    ) {
      continue;
    }

    const alt = img.getAttribute("alt")?.trim() ?? "";
    const title = img.getAttribute("title")?.trim() ?? "";
    const ariaLabel = img.getAttribute("aria-label")?.trim() ?? "";

    if (alt.length > 0 && hasSupportedLanguageEvidence(alt, img)) {
      targets.push({ element: img, sourceText: alt, attributeType: "alt" });
    } else if (title.length > 0 && hasSupportedLanguageEvidence(title, img)) {
      targets.push({ element: img, sourceText: title, attributeType: "title" });
    } else if (
      ariaLabel.length > 0 &&
      hasSupportedLanguageEvidence(ariaLabel, img)
    ) {
      targets.push({ element: img, sourceText: ariaLabel, attributeType: "aria-label" });
    }
  }

  return targets;
}
