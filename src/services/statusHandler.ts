import { store, trackPower, turnoutMap } from '../index';
import type { TurnoutPacket } from '@trainlink-org/trainlink-types';
import { log } from '../logger';

import type { CustomSocket } from '../socket';

/**
 * Constructs a packet containing the current state of the locoStore
 * @param socket socket to send the packet to
 */
export function sendLocoState(socket: CustomSocket) {
    const locosArray: string[] = [];
    for (const loco of store.getAllLocos()) {
        locosArray.push(JSON.stringify(loco));
    }
    socket.emit('metadata/initialState/locos', locosArray);
    log('Sent initial state');
}

/**
 * Constructs a packet containing the current state of all the turnouts
 * @param socket The socket to send the packet to
 */
export async function sendTurnoutMapState(socket: CustomSocket) {
    const turnoutPacket: TurnoutPacket = {
        turnouts: await turnoutMap.getTurnouts(),
        destinations: await turnoutMap.getDestinations(),
        links: await turnoutMap.getLinks(),
    };
    socket.emit('metadata/initialState/turnouts', turnoutPacket);
    turnoutMap.sendInitialState(socket);
}

/**
 * Constructs a packet containing the current state of the track power
 * @param socket The socket to send the packet to
 */
export function sendTrackState(socket: CustomSocket) {
    socket.emit('metadata/initialState/trackPower', trackPower.state);
}
