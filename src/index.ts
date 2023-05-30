import { LocoStore } from './locos';
import { AutomationRuntime } from './automation';
import { dbConnection } from './database';
import { io, startSocketServer } from './socket';
import { DummyHardwareAdapter, SocketHardwareAdapter } from './adapter';
import { TurnoutMap } from './turnouts';

export function startServer() {
    dbConnection.connect();
    startSocketServer(process.env.NODE_DOCKER_PORT);
    void store.loadSave();
    turnoutMap.loadTurnoutMap();
    runtime.loadPersistentScripts();
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

export const store = new LocoStore();
export const runtime = new AutomationRuntime(store, (runningAutomations) => {
    io.emit('automation/fetchRunningResponse', runningAutomations);
});
runtime.registerPersistentUpdateCallback(() => {
    const automationList = runtime.getAllAutomations();
    console.log(automationList);
    io.emit('automation/fetchAllResponse', automationList);
});

export const adapter = new DummyHardwareAdapter();

export const trackPower = { state: false };

export const turnoutMap = new TurnoutMap();
