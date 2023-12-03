// import { version as serverVersion, runtime, turnoutMap } from './index';
import { type ServerConfig, version as serverVersion } from './index';
import {
    type ServerToClientEvents,
    type ClientToServerEvents,
    AutomationError,
    AutomationErrorType,
    type Coordinate,
} from '@trainlink-org/trainlink-types';
import { log } from './logger';
import type { HardwareAdapter } from './adapter';

import * as throttleHandler from './throttle/throttleHandler';
import * as statusHandler from './services/statusHandler';
import * as throttleConfig from './services/throttleConfig';
import {
    validateAddress,
    validateName,
    validateCurrentAddress,
    validateUpdatedLoco,
} from './services/dataValidation';
import * as routesConfig from './services/routesConfig';

import { Server, type Socket } from 'socket.io';
import type { Runtime } from './automation/runtime';
import type { TurnoutMap } from './turnouts';
import type { LocoStore } from './locos';

import semver, { Range, SemVer } from 'semver';

import pkg from '../package.json';
/** The socket.io server */
export let io: Server<ClientToServerEvents, ServerToClientEvents>;

export type CustomSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type SocketIoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export let userCount = 0;

/**
 * Starts the socket server and handles incoming socket requests
 * @param serverConfig Configuration settings for the server
 * @param store LocoStore used by the server
 * @param runtime Automation runtime used by the server
 * @param turnoutMap Turnout map used by the server
 * @param adapter Hardware adapter used by the server
 */
export function startSocketServer(
    // portString: string | undefined,
    serverConfig: ServerConfig,
    store: LocoStore,
    runtime: Runtime,
    turnoutMap: TurnoutMap,
    adapter: HardwareAdapter,
) {
    // Creates a new socket.io server
    io = new Server<ClientToServerEvents, ServerToClientEvents>(
        serverConfig.port,
        {
            cors: {
                // origin: '*',
                origin: true,
            },
        },
    );
    io.on('connection', (socket) => {
        socket.on('metadata/handshake', (_name, version) => {
            socket.data.version = version;
            const versionString = semver.parse(version) || new SemVer('0.0.0');
            if (
                semver.satisfies(
                    versionString,
                    new Range(
                        `${serverVersion.major}.${serverVersion.minor}.x`,
                    ),
                    {
                        includePrerelease: serverVersion.prerelease.length
                            ? true
                            : false,
                    },
                )
            ) {
                // Client is compatible
                userCount += 1;
                log(`A user connected (${userCount} in total)`);
                socket.emit(
                    'metadata/handshake',
                    pkg.name,
                    serverConfig.productName,
                    serverVersion.version,
                );
                statusHandler.sendLocoState(socket, store);
                //TODO implement error handling
                void statusHandler.sendTurnoutMapState(socket, turnoutMap);
                statusHandler.sendTrackState(socket);
                statusHandler.sendHardwareState(socket, adapter);
            } else {
                // Client incompatible so disconnect
                socket.disconnect(true);
            }
        });

        // Handle all events

        socket.on('disconnect', (reason) => {
            userCount -= 1;
            log(`A user disconnected: ${reason}`);
        });
        socket.on('throttle/setSpeed', (identifier, speed) => {
            throttleHandler.speedChange(identifier, speed, io, socket, store);
        });
        socket.on('throttle/setDirection', (identifier, direction) => {
            throttleHandler.setDirection(
                identifier,
                direction,
                io,
                socket,
                store,
            );
        });
        socket.on('throttle/setFunction', (identifier, functionNum, state) => {
            throttleHandler.setFunction(
                identifier,
                functionNum,
                state,
                io,
                socket,
                store,
            );
        });
        socket.on('throttle/setTrackPower', (state) => {
            throttleHandler.setTrackPower(state, io, socket, adapter);
        });
        socket.on('automation/fileUpload', async (name, file) => {
            await runtime
                .addScriptFile(file)
                .catch((error: AutomationError) => {
                    log(error.message);
                    socket.emit(
                        'automation/processingError',
                        error.message
                            ? error
                            : new AutomationError(
                                  AutomationErrorType.unknownError,
                                  'An unknown error occurred',
                              ),
                    );
                });
            const automationList = runtime.getAllAutomations();
            io.emit('automation/fetchAllResponse', automationList);
        });
        socket.on('automation/fetchAll', () => {
            const automationList = runtime.getAllAutomations();
            io.emit('automation/fetchAllResponse', automationList);
        });
        socket.on('automation/fetchRunning', () => {
            const automationList = runtime.getRunningAutomations();
            io.emit('automation/fetchRunningResponse', automationList);
        });
        socket.on('automation/pauseAutomation', (pid) => {
            runtime.pauseAutomation(pid);
        });
        socket.on('automation/resumeAutomation', (pid) => {
            runtime.resumeAutomation(pid);
        });
        socket.on('automation/stopAutomation', (pid) => {
            runtime.stopAutomation(pid);
        });
        socket.on('automation/executeAutomation', (id, locoID) => {
            //TODO implement error handling
            void runtime.runScript(id, locoID);
        });
        socket.on('automation/deleteAutomation', (scriptID) => {
            runtime.deleteAutomation(scriptID);
        });
        socket.on('automation/setDescription', (id, description) => {
            runtime.setDescription(id, description);
        });
        socket.on('routes/setTurnout', (turnoutID, turnoutState) => {
            //TODO implement error handling
            void turnoutMap.setTurnout(turnoutID, turnoutState);
        });
        socket.on('routes/setRoute', (start, end) => {
            //TODO implement error handling
            void turnoutMap.setRoute(start, end);
        });
        socket.on('config/addLoco', async (name, address) => {
            if (
                (await validateName(name, store)) &&
                (await validateAddress(address, store))
            ) {
                throttleConfig.addLoco(store, name, address);
            }
        });
        socket.on(
            'config/editLoco',
            async (oldAddress, newName, newAddress) => {
                if (
                    await validateUpdatedLoco(
                        oldAddress,
                        newName,
                        newAddress,
                        store,
                    )
                ) {
                    throttleConfig.editLoco(
                        store,
                        oldAddress,
                        newAddress,
                        newName,
                    );
                }
            },
        );
        socket.on('config/deleteLoco', async (address: number) => {
            if (await validateCurrentAddress(address, store)) {
                throttleConfig.deleteLoco(store, address);
            }
        });
        socket.on(
            'config/routes/changeObjectCoordinate',
            (id: number, coord: Coordinate) => {
                routesConfig.changeCoordinate(id, coord, turnoutMap);
            },
        );
        socket.on('hardware/getDevices', async () => {
            socket.emit(
                'hardware/availableDevices',
                await adapter.availableDevices,
            );
        });
        socket.on('hardware/setDriver', (driver, address) => {
            adapter.selectDriver(driver, address);
            socket.emit('hardware/newActiveDevice', adapter.device);
        });
        socket.on('hardware/setDevice', (device) => {
            adapter.selectDevice(device);
            socket.emit('hardware/newActiveDevice', device);
        });
    });
    log('\nListening on port %d', serverConfig.port);
}
