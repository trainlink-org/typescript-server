import { env } from 'node:process';

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
console.log(osConfigDir);
env.DB_PATH = process.env.DB_PATH || osConfigDir + '/database.db';
console.log(env.DB_PATH);

import { startServer } from '.';
startServer();
