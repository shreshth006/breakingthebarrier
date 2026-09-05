import type {
  RememberedPageCommand,
  RememberedPageResponse,
} from "../shared/messages";
import type { DetectionSummary } from "./detection-controller";
import type { DetectionPrompt, DetectionPromptActions } from "../ui/in-page/prompt";

export interface RememberedPageDependencies {
  send(command: RememberedPageCommand): Promise<RememberedPageResponse | null>;
  createDetection(): RememberedPageDetection;
  showPrompt(actions: DetectionPromptActions): DetectionPrompt;
}

export interface RememberedPageDetection {
  start(
    onDetected: (summary: DetectionSummary) => void,
  ): Promise<DetectionSummary>;
  stop(): void;
}

export class RememberedPageCoordinator {
  readonly #dependencies: RememberedPageDependencies;
  #detection: RememberedPageDetection | undefined;
  #prompt: DetectionPrompt | undefined;
  #detectedEligibleNodes = 0;

  constructor(dependencies: RememberedPageDependencies) {
    this.#dependencies = dependencies;
  }

  async start(): Promise<void> {
    this.stop();
    const response = await this.#dependencies.send("bootstrap");
    if (response?.action !== "ask") {
      return;
    }
    const detection = this.#dependencies.createDetection();
    this.#detection = detection;
    await detection.start((summary) => {
      if (this.#detection !== detection) {
        return;
      }
      this.#detection = undefined;
      this.#detectedEligibleNodes = summary.eligibleNodes;
      this.#prompt = this.#dependencies.showPrompt({
        romanize: async () => {
          const started = await this.#dependencies.send("start");
          if (started?.action === "active") {
            this.#prompt = undefined;
            this.#detectedEligibleNodes = 0;
            return true;
          }
          return false;
        },
        dismiss: () => {
          this.#prompt = undefined;
          this.#detectedEligibleNodes = 0;
        },
      });
    });
  }

  stop(): void {
    const detection = this.#detection;
    const prompt = this.#prompt;
    this.#detection = undefined;
    this.#prompt = undefined;
    this.#detectedEligibleNodes = 0;
    detection?.stop();
    prompt?.dismiss();
  }

  detectedEligibleNodes(): number {
    return this.#detectedEligibleNodes;
  }
}
