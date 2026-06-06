import {
  ToolExecutionContext,
  toolExecutorService,
} from '../../services/tool-executor.service';

export class RealtimeToolHandler {
  async execute(
    name: string,
    argsJson: string,
    context: ToolExecutionContext
  ): Promise<string> {
    return toolExecutorService.execute(name, argsJson, context);
  }
}

export const realtimeToolHandler = new RealtimeToolHandler();

export type { ToolExecutionContext };
