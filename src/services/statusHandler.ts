import { trackPower } from '../index';
import type { TurnoutPacket } from '@trainlink-org/trainlink-types';
import { log } from '../logger';

import type { CustomSocket } from '../socket';
import type { LocoStore } from '../locos';
import type { TurnoutMap } from '../turnouts';
import type { HardwareAdapter } from '../adapter';
import { availableDrivers } from '../adapter/drivers';

/**
 * Constructs a packet containing the current state of the locoStore
 * @param socket socket to send the packet to
 * @param store The LocoStore instance
 */
export function sendLocoState(socket: CustomSocket, store: LocoStore) {
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
 * @param turnoutMap The TurnoutMap used to set the turnout
 */
export async function sendTurnoutMapState(
    socket: CustomSocket,
    turnoutMap: TurnoutMap
) {
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

/**
 * Finds the active driver and device and sends it to a client
 * @param socket The socket to send the packet to
 * @param adapter The hardware adapter to retrieve the state from
 */
export function sendHardwareState(
    socket: CustomSocket,
    adapter: HardwareAdapter
) {
    socket.emit('metadata/availableDrivers', availableDrivers);
    socket.emit(
        'hardware/driverChanged',
        adapter.driverName,
        adapter.driverMsg
    );
    socket.emit('hardware/newActiveDevice', adapter.device);
}
