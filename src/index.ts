import { LocoStore } from './locos';
import { AutomationRuntime } from './automation';
import { io, startSocketServer } from './socket';
import { DummyHardwareAdapter, SocketHardwareAdapter } from './adapter';
import { TurnoutMap } from './turnouts';
import { setupDB } from './database';
import { log } from './logger';

export async function startServer(serverConfig: ServerConfig) {
    if (serverConfig.productName) {
        version.name = serverConfig.productName;
    }
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
export const version = {
    name: process.env.npm_package_name?.replace('-', ' ') || 'Default server',
    version: process.env.npm_package_version || '0.0.0',
};

if (isDebug) {
    version.version += ' (Dev)';
}

export const trackPower = { state: false };

// export const turnoutMap = new TurnoutMap();

export interface ServerConfig {
    configPath: string;
    port: number;
    dbName?: string;
    logPath?: string;
    productName?: string;
}
