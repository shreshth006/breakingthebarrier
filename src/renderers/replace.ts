import type { TransliterationResult } from "../engines/contracts";
import type { NodeState } from "../content/node-state";
import type { Renderer } from "./contracts";

export const replaceRenderer: Renderer = {
  id: "replace-v1",
  apply(target: Text, result: TransliterationResult, state: NodeState): boolean {
    if (target.data !== state.source || result.source !== state.source) {
      return false;
    }
    state.rendered = result.rendered;
    state.status = "rendered";
    target.data = result.rendered;
    return true;
  },
};
