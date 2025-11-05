import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { createConsola } from 'consola';
import type { ConsolaInstance } from 'consola';

/**
 * Simple logger using consola v3.4.2 - https://github.com/unjs/consola
 * Outputs to console and rotating file in .logs/
 */

const logsDir = join(process.cwd(), '.logs');

// Ensure logs directory exists
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Create rotating log file (one per day)
const logFile = join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);
const fileStream = createWriteStream(logFile, { flags: 'a' });

// Create consola with console output and file reporter
export const logger: ConsolaInstance = createConsola({
  level: 3, // Info level (0=silent, 1=error, 2=warn, 3=info, 4=debug, 5=trace)
  reporters: [
    // Default console reporter
    {
      log: (logObj) => {
        const args = logObj.args.join(' ');
        console.log(`[${logObj.type}]`, args);
      },
    },
    // File reporter
    {
      log: (logObj) => {
        fileStream.write(JSON.stringify({ ...logObj, date: new Date().toISOString() }) + '\n');
      },
    },
  ],
});
