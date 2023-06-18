import { env } from 'node:process';
import { type ServerConfig, startServer } from '.';
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
// env.DB_PATH = process.env.DB_PATH || osConfigDir + '/database.db';
// log('Starting Server...', LogLevel.Info, false);
const serverConfig: ServerConfig = {
    configPath: process.env.TL_DB_PATH || osConfigDir,
    port: parseInt(process.env.TL_PORT || '6868'),
};
log('Starting Server...', undefined, true);
startServer(serverConfig);
