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

// Create consola instance with console + file output
export const logger: ConsolaInstance = createConsola({
  reporters: [
    {
      log: (logObj) => {
        // Write to file
        fileStream.write(JSON.stringify({ ...logObj, date: new Date().toISOString() }) + '\n');
      },
    },
  ],
});
