import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { collectEligibleImageElements } from "../../src/content/image-scanner";
import {
  applyImageTransliteration,
  restoreImageElement,
} from "../../src/renderers/image-overlay";

describe("Image text transliteration", () => {
  it("collects images with foreign script alt/title attributes", () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <img id="img1" src="test1.jpg" alt="ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" />
          <img id="img2" src="test2.jpg" alt="English banner" />
          <img id="img3" src="test3.jpg" title="お勉強" />
        </body>
      </html>
    `);
    const doc = dom.window.document;
    const targets = collectEligibleImageElements(doc);

    expect(targets).toHaveLength(2);
    expect(targets[0]?.sourceText).toBe("ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ");
    expect(targets[0]?.attributeType).toBe("alt");
    expect(targets[1]?.sourceText).toBe("お勉強");
    expect(targets[1]?.attributeType).toBe("title");
  });

  it("applies and restores image overlay badges and attributes cleanly", () => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="container">
            <img id="img1" src="test1.jpg" alt="ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ" title="Original Title" />
          </div>
        </body>
      </html>
    `);
    const doc = dom.window.document;
    const img = doc.querySelector("#img1");
    if (!(img instanceof dom.window.HTMLImageElement)) {
      throw new Error("Missing test image");
    }

    const state = applyImageTransliteration(
      img,
      "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ",
      "sti sri akal",
      "annotation",
    );

    expect(state.overlayElement).toBeDefined();
    expect(doc.querySelector(".btb-image-overlay-badge")).not.toBeNull();
    expect(doc.querySelector(".btb-img-rt")?.textContent).toBe("sti sri akal");
    expect(img.getAttribute("alt")).toBe("ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ (sti sri akal)");
    expect(img.getAttribute("title")).toBe("Original Title (sti sri akal)");

    restoreImageElement(state);
    expect(doc.querySelector(".btb-image-overlay-badge")).toBeNull();
    expect(img.getAttribute("alt")).toBe("ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ");
    expect(img.getAttribute("title")).toBe("Original Title");
  });
});

