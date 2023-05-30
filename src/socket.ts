import { version as serverVersion, runtime, turnoutMap } from './index';
import {
    type ServerToClientEvents,
    type ClientToServerEvents,
    AutomationError,
    AutomationErrorType,
    type Coordinate,
} from '@trainlink-org/trainlink-types';
import { log } from './logger';

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

/** The socket.io server */
export let io: Server<ClientToServerEvents, ServerToClientEvents>;

export type CustomSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type SocketIoServer = Server<ClientToServerEvents, ServerToClientEvents>;

export let userCount = 0;

export function startSocketServer(portString: string | undefined) {
    const port = validateEnvInt(portString, 3001);

    // Creates a new socket.io server
    io = new Server<ClientToServerEvents, ServerToClientEvents>(port, {
        cors: {
            origin: '*',
        },
    });
    io.on('connection', (socket) => {
        socket.on('metadata/handshake', (_name, version) => {
            socket.data.version = version;
            // Check the clients version is compatible with the server
            const versionString: string = version.toString();
            if (
                versionString.split('.')[0] ===
                serverVersion.version?.split('.')[0]
            ) {
                // Client is compatible
                userCount += 1;
                log(`A user connected (${userCount} in total)`);
                socket.emit(
                    'metadata/handshake',
                    serverVersion.name,
                    serverVersion.version
                );
                statusHandler.sendLocoState(socket);
                //TODO implement error handling
                void statusHandler.sendTurnoutMapState(socket);
                statusHandler.sendTrackState(socket);
            } else {
                // Client incompatible so disconnect
                socket.disconnect();
            }
        });

        // Handle all events

        socket.on('disconnect', (reason) => {
            userCount -= 1;
            log(`A user disconnected: ${reason}`);
        });
        socket.on('throttle/setSpeed', (identifier, speed, throttleID) => {
            throttleHandler.speedChange(
                identifier,
                speed,
                throttleID,
                io,
                socket
            );
        });
        socket.on('throttle/switchDirection', (identifier) => {
            throttleHandler.changeDirection(identifier, io);
        });
        socket.on('throttle/setDirection', (identifier, direction) => {
            console.log(direction);
            throttleHandler.setDirection(identifier, direction, io, socket);
        });
        socket.on('throttle/setFunction', (identifier, functionNum, state) => {
            throttleHandler.setFunction(identifier, functionNum, state, io);
        });
        socket.on('throttle/setTrackPower', (state) => {
            throttleHandler.setTrackPower(state, io, socket);
        });
        socket.on('automation/fileUpload', async (name, file) => {
            await runtime
                .addScriptFile(file)
                .catch((error: AutomationError) => {
                    console.log(error.message);
                    socket.emit(
                        'automation/processingError',
                        error.message
                            ? error
                            : new AutomationError(
                                  AutomationErrorType.unknownError,
                                  'An unknown error occurred'
                              )
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
                (await validateName(name)) &&
                (await validateAddress(address))
            ) {
                throttleConfig.addLoco(name, address);
            }
        });
        socket.on(
            'config/editLoco',
            async (oldAddress, newName, newAddress) => {
                if (
                    await validateUpdatedLoco(oldAddress, newName, newAddress)
                ) {
                    throttleConfig.editLoco(oldAddress, newAddress, newName);
                }
            }
        );
        socket.on('config/deleteLoco', async (address: number) => {
            if (await validateCurrentAddress(address)) {
                throttleConfig.deleteLoco(address);
            }
        });
        socket.on(
            'config/routes/changeObjectCoordinate',
            (id: number, coord: Coordinate) => {
                routesConfig.changeCoordinate(id, coord);
            }
        );
    });
    log('\nListening on port %d', port);
}

function validateEnvInt(port: string | undefined, fallback: number) {
    return parseInt(port ?? fallback.toString()) || fallback;
}
