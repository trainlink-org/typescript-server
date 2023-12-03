import { trackPower } from '../index';
import { Direction, type LocoIdentifier } from '@trainlink-org/trainlink-types';
import type { HardwareAdapter } from '../adapter';
import { type LocoStore, SyncLevel } from '../locos';
import type { SocketIoServer } from '../socket';

import type { Socket } from 'socket.io';

/**
 * Used to update the speed of a loco in response to a socket packet and update other clients
 * @param identifier The identifier of the loco
 * @param speed The new speed
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 * @param store The LocoStore instance
 */
export function speedChange(
    identifier: LocoIdentifier,
    speed: number,
    io: SocketIoServer,
    socket: Socket,
    store: LocoStore,
) {
    store
        .getLoco(identifier, SyncLevel.SerialOnly)
        .then((loco) => (loco.speed = speed))
        .catch();
    io.emit('throttle/speedUpdate', identifier, speed, socket.id);
}

/**
 * Used to update the direction of a loco in response to a socket packet and update other clients
 * @param identifier The identifier of the loco
 * @param direction The new direction
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 * @param store The LocoStore instance
 */
export function setDirection(
    identifier: LocoIdentifier,
    direction: Direction,
    io: SocketIoServer,
    socket: Socket,
    store: LocoStore,
) {
    store
        .getLoco(identifier)
        .then((loco) => {
            loco.direction = direction;
            if (direction === Direction.stopped) {
                loco.speed = 0;
                io.emit('throttle/speedUpdate', identifier, 0, socket.id);
                io.emit(
                    'throttle/directionUpdate',
                    identifier,
                    direction,
                    socket.id,
                );
            } else {
                io.emit(
                    'throttle/directionUpdate',
                    identifier,
                    direction,
                    socket.id,
                );
            }
        })
        .catch();
}

/**
 * Used to update a cab function of a loco
 * @param identifier Identifier of the loco
 * @param functionNum The function number
 * @param state The state to set it to
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 * @param store The LocoStore instance
 */
export function setFunction(
    identifier: LocoIdentifier,
    functionNum: number,
    state: boolean,
    io: SocketIoServer,
    socket: Socket,
    store: LocoStore,
) {
    store
        .getLoco(identifier)
        .then((loco) => {
            loco.setFunction(functionNum, state);
            io.emit(
                'throttle/functionUpdate',
                identifier,
                functionNum,
                state,
                socket.id,
            );
        })
        .catch();
}

/**
 * Used to update the track power state
 * @param state Track power state to set
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 * @param adapter The hardware adapter instance
 */
export function setTrackPower(
    state: boolean,
    io: SocketIoServer,
    socket: Socket,
    adapter: HardwareAdapter,
) {
    adapter.trackPowerSet(state);
    trackPower.state = state;
    io.emit('throttle/trackPowerUpdate', state, socket.id);
}
