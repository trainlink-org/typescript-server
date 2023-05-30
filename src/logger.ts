import { debug } from './index';

/**
 * Describes the severity of log message
 */
export enum LogLevel {
    Info,
    Warning,
    Error,
}

/**
 * Logs a message to stdout or stderr if debug is enabled
 * @param msg The message to log
 * @param level Describes the severity of the log message
 */
export function log(msg: unknown, level = LogLevel.Info) {
    if (debug) {
        switch (level) {
            case LogLevel.Info:
                console.log(`${msg}`);
                break;

            case LogLevel.Warning:
                console.log(`Warning: ${msg}`);
                break;

            case LogLevel.Error:
                console.error(`Error: ${msg}`);
        }
    }
}
