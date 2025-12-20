import { Injectable, Logger } from "@nestjs/common";
import { TingwuService } from "../tingwu/tingwu.service";
import { ConfigService } from "@nestjs/config";

type PollerCallback = (payload: {
  transcription: any[];
  summaries: any[];
  taskStatus?: string;
}) => Promise<void>;

@Injectable()
export class PollerService {
  private readonly logger = new Logger(PollerService.name);
  private readonly intervalMs: number;
  private readonly tasks = new Map<
    string,
    { taskId: string; timer: NodeJS.Timeout; callback: PollerCallback }
  >();

  constructor(
    private readonly tingwuService: TingwuService,
    private readonly configService: ConfigService
  ) {
    this.intervalMs = this.configService.get<number>("pollingIntervalMs", 5000);
  }

  registerTask(sessionId: string, taskId: string, callback: PollerCallback) {
    this.unregisterTask(sessionId);
    const timer = setInterval(async () => {
      try {
        const snapshot = await this.fetchSnapshot(taskId);
        await callback(snapshot);
      } catch (error) {
        this.logger.error(`Polling failed for task ${taskId}`, error);
      }
    }, this.intervalMs);
    this.tasks.set(sessionId, { taskId, timer, callback });
  }

  unregisterTask(sessionId: string) {
    const entry = this.tasks.get(sessionId);
    if (entry) {
      clearInterval(entry.timer);
      this.tasks.delete(sessionId);
    }
  }

  private async fetchSnapshot(taskId: string) {
    return this.tingwuService.getTaskSnapshot(taskId);
  }
}
