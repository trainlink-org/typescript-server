import { LocoStore } from './locos';
import { AutomationRuntime } from './automation';
import { io, startSocketServer } from './socket';
import { HardwareAdapter } from './adapter';
import { TurnoutMap } from './turnouts';
import { setupDB } from './database';
import { log } from './logger';
import semver, { SemVer } from 'semver';

/**
 * Starts the server
 * @param serverConfig The configuration to use for the server
 */
export async function startServer(serverConfig: ServerConfig) {
    // Create the new hardware adapter
    const adapter = new HardwareAdapter((adapter) => {
        io.emit(
            'hardware/driverChanged',
            adapter.driverName,
            adapter.driverMsg
        );
    });

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
        log(automationList);
        io.emit('automation/fetchAllResponse', automationList);
    });
    turnoutMap.loadTurnoutMap();
    runtime.loadPersistentScripts();
    // Starts the Socket.IO server
    startSocketServer(serverConfig, store, runtime, turnoutMap, adapter);
}

export const isDebug = process.env.NODE_ENV === 'development';
export const version =
    semver.parse(process.env.npm_package_version) || new SemVer('0.0.0');

export const trackPower = { state: false };

export interface ServerConfig {
    configPath: string;
    port: number;
    dbName?: string;
    logPath?: string;
    productName: string;
}
