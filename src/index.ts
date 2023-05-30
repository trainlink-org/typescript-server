import { LocoStore } from './locos';
import { AutomationRuntime } from './automation';
import { dbConnection } from './database';
import { startServer } from './socket';
import { SocketHardwareAdapter } from './adapter';
import { io } from './socket';
import { TurnoutMap } from './turnouts';

dbConnection.connect();
startServer(process.env.NODE_DOCKER_PORT);

const environment = process.env.NODE_ENV;
export const debug = environment === 'development';
export const version = {
    name: process.env.npm_package_name?.replace('-', ' ') || 'Default server',
    version: process.env.npm_package_version || '0.0.0',
};

if (debug) {
    version.version += ' (Dev)';
}

export const store = new LocoStore();
store.loadSave();
export const runtime = new AutomationRuntime(store, (runningAutomations) => {
    io.emit('automation/fetchRunningResponse', runningAutomations);
});
runtime.registerPersistentUpdateCallback(() => {
    const automationList = runtime.getAllAutomations();
    console.log(automationList);
    io.emit('automation/fetchAllResponse', automationList);
});

export const adapter = new SocketHardwareAdapter();

export const trackPower = { state: false };

export const turnoutMap = new TurnoutMap();
turnoutMap.loadTurnoutMap();
