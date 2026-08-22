import { EventEmitter } from "node:events";

export type FusionEvent = {
  ts: string;
  type: string;
  message: string;
  stepId?: number;
  data?: Record<string, unknown>;
};

class FusionBus extends EventEmitter {
  history: FusionEvent[] = [];

  emitEvent(type: string, message: string, extra?: Partial<FusionEvent>): FusionEvent {
    const event: FusionEvent = {
      ts: new Date().toISOString(),
      type,
      message,
      ...extra,
    };
    this.history.push(event);
    if (this.history.length > 500) this.history.shift();
    this.emit("event", event);
    return event;
  }
}

export const bus = new FusionBus();
