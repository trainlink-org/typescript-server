import { LocoStore } from './locos';
import { AutomationRuntime } from './automation';
import { io, startSocketServer } from './socket';
import { DummyHardwareAdapter, SocketHardwareAdapter } from './adapter';
import { TurnoutMap } from './turnouts';
import { setupDB } from './database';
import { log } from './logger';
import semver, { SemVer } from 'semver';

export async function startServer(serverConfig: ServerConfig) {
    // Create the new hardware adapter
    const adapter = new DummyHardwareAdapter();

    // Opens the database
    const dbConnection = await setupDB(
        serverConfig.configPath + '/' + (serverConfig.dbName || 'database.db')
    );

    // Create the LocoStore
    const store = new LocoStore(dbConnection, adapter);
    await store.loadSave();
    log(store.toString());

    // Create an automation runtime
    const turnoutMap = new TurnoutMap(dbConnection, adapter);
    const runtime = new AutomationRuntime(
        store,
        turnoutMap,
        dbConnection,
        (runningAutomations) => {
            io.emit('automation/fetchRunningResponse', runningAutomations);
        }
    );
    turnoutMap.attachRuntime(runtime);
    runtime.registerPersistentUpdateCallback(() => {
        const automationList = runtime.getAllAutomations();
        console.log(automationList);
        io.emit('automation/fetchAllResponse', automationList);
    });
    turnoutMap.loadTurnoutMap();
    runtime.loadPersistentScripts();
    // Starts the Socket.IO server
    startSocketServer(serverConfig, store, runtime, turnoutMap, adapter);
}

const environment = process.env.NODE_ENV;
export const isDebug = environment === 'development';
// export const version = {
//     name: process.env.npm_package_name?.replace('-', ' ') || 'Default server',
//     // version: process.env.npm_package_version || '0.0.0',
//     // major: parseInt(process.env.npm_package_version?.split('.')[0] || '0'),
//     // minor: parseInt(process.env.npm_package_version?.split('.')[1] || '0'),
//     // patch: parseInt(process.env.npm_package_version?.split('.')[2] || '0'),
//     // tag: process.env.npm_package_version?.split('-').
//     major: semver.major(process.env.npm_package_name || '0.0.0'),
//     minor: semver.minor(process.env.npm_package_name || '0.0.0'),
//     semver: semver.parse(process.env.npm_package_name || '0.0.0'),
// };
export const version =
    semver.parse(process.env.npm_package_version) || new SemVer('0.0.0');

// if (isDebug) {
//     version.version += ' (Dev)';
// }

export const trackPower = { state: false };

// export const turnoutMap = new TurnoutMap();

export interface ServerConfig {
    configPath: string;
    port: number;
    dbName?: string;
    logPath?: string;
    productName: string;
}
