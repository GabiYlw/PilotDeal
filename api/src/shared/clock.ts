export interface Clock {
  now(): Date;
}

// The only place that reads the system time. Everything else asks a Clock,
// so tests can fix "now" without fake timers.
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
