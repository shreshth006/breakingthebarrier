import {
  CONTENT_SCAN_SLICE_BUDGET_MS,
  CONTENT_SCAN_SLICE_NODE_LIMIT,
} from "../shared/config";

export interface SliceScheduler {
  now(): number;
  yield(): Promise<void>;
}

export const browserSliceScheduler: SliceScheduler = {
  now: () => performance.now(),
  yield: () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0);
    }),
};

export interface SliceLimits {
  readonly budgetMs: number;
  readonly nodeLimit: number;
}

export const defaultSliceLimits: SliceLimits = {
  budgetMs: CONTENT_SCAN_SLICE_BUDGET_MS,
  nodeLimit: CONTENT_SCAN_SLICE_NODE_LIMIT,
};
