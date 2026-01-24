import { Logger as ZarioLogger, ConsoleTransport } from 'zario';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ANSI_GREEN = '\x1b[32m';
const ANSI_RED = '\x1b[31m';
const ANSI_RESET = '\x1b[0m';

class Logger {
  private zario: ZarioLogger;
  private prefix: string;

  constructor(options: { level?: LogLevel; prefix?: string } = {}) {
    this.prefix = options.prefix ?? 'ignite';
    this.zario = new ZarioLogger({
      level: options.level ?? 'info',
      colorize: true,
      transports: [new ConsoleTransport()],
      prefix: `[${this.prefix}]`,
    });
  }

  debug(message: string, ...args: unknown[]): void {
    this.zario.debug(this.formatMessage(message, args));
  }

  info(message: string, ...args: unknown[]): void {
    this.zario.info(this.formatMessage(message, args));
  }

  warn(message: string, ...args: unknown[]): void {
    this.zario.warn(this.formatMessage(message, args));
  }

  error(message: string, ...args: unknown[]): void {
    this.zario.error(this.formatMessage(message, args));
  }

  success(message: string): void {
    console.log(`${ANSI_GREEN}✓${ANSI_RESET} ${message}`);
  }

  failure(message: string): void {
    console.log(`${ANSI_RED}✗${ANSI_RESET} ${message}`);
  }

  setLevel(level: LogLevel): void {
    this.zario = new ZarioLogger({
      level,
      colorize: true,
      transports: [new ConsoleTransport()],
      prefix: `[${this.prefix}]`,
    });
  }

  child(prefix: string): Logger {
    return new Logger({ prefix: `${this.prefix}:${prefix}` });
  }

  private formatMessage(message: string, args: unknown[]): string {
    if (args.length === 0) return message;
    return `${message} ${args.map((a) => JSON.stringify(a)).join(' ')}`;
  }
}

export const logger = new Logger({ level: 'info' });
export { Logger, LogLevel };
