export interface Logger {
  warn(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  warn(message: string, context?: Record<string, unknown>): void {
    if (context === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, context);
  }
}
