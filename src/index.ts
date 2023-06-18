import { LocoStore } from './locos';
import { AutomationRuntime } from './automation';
// import { dbConnection } from './database';
import { io, startSocketServer } from './socket';
import { DummyHardwareAdapter, SocketHardwareAdapter } from './adapter';
import { TurnoutMap } from './turnouts';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { env } from 'node:process';
import { setupDB } from './database';

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
    console.log(store.toString());

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
    startSocketServer(serverConfig.port, store, runtime, turnoutMap, adapter);
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

// export const store = new LocoStore();
// export const runtime = new AutomationRuntime(store, (runningAutomations) => {
//     io.emit('automation/fetchRunningResponse', runningAutomations);
// });
// runtime.registerPersistentUpdateCallback(() => {
//     const automationList = runtime.getAllAutomations();
//     console.log(automationList);
//     io.emit('automation/fetchAllResponse', automationList);
// });

export const trackPower = { state: false };

// export const turnoutMap = new TurnoutMap();

export interface ServerConfig {
    configPath: string;
    port: number;
    dbName?: string;
    logPath?: string;
}
