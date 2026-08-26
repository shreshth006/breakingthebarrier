import type { TransliterationResult } from "../engines/contracts";
import type { NodeState } from "../content/node-state";

export interface Renderer {
  readonly id: "replace-v1";
  apply(target: Text, result: TransliterationResult, state: NodeState): boolean;
}
