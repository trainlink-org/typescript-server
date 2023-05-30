import { adapter, store, trackPower } from '../index';
import {
    Direction,
    LocoIdentifier,
    ServerToClientEvents,
    ClientToServerEvents,
} from '@trainlink-org/trainlink-types';
import { SyncLevel } from '../locos';
import { SocketIoServer } from '../socket';

import { Server, Socket } from 'socket.io';

/**
 * Used to update the speed of a loco in response to a socket packet and update other clients
 * @param identifier The identifier of the loco
 * @param speed The new speed
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 */
export function speedChange(
    identifier: LocoIdentifier,
    speed: number,
    throttleID: number,
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket
) {
    store
        .getLoco(identifier, SyncLevel.SerialOnly)
        .then((loco) => (loco.speed = speed))
        .catch();
    io.emit('throttle/speedUpdate', identifier, speed, socket.id, throttleID);
}

/**
 * Used to flip the direction of a loco in response to a socket packet and update other clients
 * @param identifier The identifier of the loco
 * @param io The socket.io server object to update other clients
 */
export function changeDirection(identifier: LocoIdentifier, io: Server) {
    store
        .getLoco(identifier)
        .then((loco) => {
            switch (loco.direction) {
                case Direction.forward:
                    loco.direction = Direction.reverse;
                    break;

                case Direction.reverse:
                    loco.direction = Direction.forward;
                    break;
            }
            io.emit('throttle/directionUpdate', identifier, loco.direction);
        })
        .catch();
}

/**
 * Used to update the direction of a loco in response to a socket packet and update other clients
 * @param identifier The identifier of the loco
 * @param direction The new direction
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 */
export function setDirection(
    identifier: LocoIdentifier,
    direction: Direction,
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket
) {
    store
        .getLoco(identifier)
        .then((loco) => {
            loco.direction = direction;
            if (direction === Direction.stopped) {
                loco.speed = 0;
                io.emit('throttle/speedUpdate', identifier, 0, socket.id, 0);
                io.emit('throttle/directionUpdate', identifier, direction);
            } else {
                io.emit('throttle/directionUpdate', identifier, direction);
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
 */
export function setFunction(
    identifier: LocoIdentifier,
    functionNum: number,
    state: boolean,
    io: SocketIoServer
) {
    store
        .getLoco(identifier)
        .then((loco) => {
            loco.setFunction(functionNum, state);
            io.emit('throttle/functionUpdate', identifier, functionNum, state);
        })
        .catch();
}

/**
 * Used to update the track power state
 * @param state Track power state to set
 * @param io The socket.io server object to update other clients
 * @param socket The socket instance that sent the message
 */
export function setTrackPower(
    state: boolean,
    io: SocketIoServer,
    socket: Socket
) {
    adapter.trackPowerSet(state);
    trackPower.state = state;
    console.log(state);
    io.emit('throttle/trackPowerUpdate', state, socket.id);
}
