import { type ServerConfig, startServer } from '.';
import { log } from './logger';
import pkg from '../package.json';

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

const serverConfig: ServerConfig = {
    configPath: process.env.TL_DB_PATH || osConfigDir,
    port: parseInt(process.env.TL_PORT || '6868'),
    productName: 'TrainLink Server',
    name: pkg.name,
};

log('Starting Server...', undefined, true);
startServer(serverConfig);
