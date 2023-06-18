import { env } from 'node:process';
import { startServer } from '.';
import { LogLevel, log } from './logger';

const osConfigDir = (() => {
    switch (process.platform) {
        case 'linux':
            return (
                (process.env.XDG_CONFIG_HOME || process.env.HOME || '~') +
                '/.config/tl-server'
            );
        case 'win32':
            return process.env.APPDATA + '\\tl-server';
        default:
            throw 'Unsupported OS';
    }
})();
env.DB_PATH = process.env.DB_PATH || osConfigDir + '/database.db';
// log('Starting Server...', LogLevel.Info, false);
log('Starting Server...', undefined, true);
startServer();
