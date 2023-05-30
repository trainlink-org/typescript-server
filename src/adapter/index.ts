import { version } from '../index';
import {
    Direction,
    TurnoutState,
    type HardwareAdapter,
} from '@trainlink-org/trainlink-types';

import { io, Socket } from 'socket.io-client';

/**
 * Handles connecting to hardware via a websocket
 */
export class SocketHardwareAdapter implements HardwareAdapter {
    /** Used to communicate with the hardware */
    private socket: Socket;
    /** Stores the previous packet */
    private prevPacket = '';

    constructor() {
        // Connect to native connector
        this.socket = io('http://host.docker.internal:3002');
        this.socket.on('connect', () => {
            console.log('Connected');
            this.socket.emit('handshake', version.version);
        });
        this.socket.on('disconnect', (reason) => {
            console.log('Hardware adapter disconnected');
            console.log(reason);
        });
    }

    /**
     * Sets the speed of a loco
     * @param address The address of the loco
     * @param speed The new speed
     * @param direction The new direction
     * @returns A promise that resolves upon completion
     */
    locoSetSpeed(
        address: number,
        speed: number,
        direction: Direction
    ): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `${address} ${speed} ${this.directionToNumber(
                direction
            )}`;
            if (packet !== this.prevPacket) {
                if (this.directionToNumber(direction) !== -1) {
                    this.socket.emit(
                        'cab/setSpeed',
                        address,
                        speed,
                        this.directionToNumber(direction)
                    );
                    this.prevPacket = packet;
                } else {
                    this.locoEstop(address);
                }
            }
            resolve();
        });
    }

    /**
     * Estops a loco
     * @param address The address of the loco
     * @returns A promise that resolves upon completion
     */
    locoEstop(address: number): Promise<void> {
        return new Promise<void>((resolve) => {
            this.socket.emit('cab/eStop', address);
            resolve();
        });
    }

    /**
     * Converts a direction to a number to use with hardware
     * @param direction The direction to convert
     * @returns The number output
     */
    private directionToNumber(direction: Direction): number {
        switch (direction) {
            case Direction.forward:
                return 1;
            case Direction.reverse:
                return 0;
            case Direction.stopped:
                return -1;
        }
    }

    /**
     * Sets the state of a turnout
     * @param id The ID of the turnout to set
     * @param state The state to set the turnout to
     * @returns A promise that resolves upon completion
     */
    turnoutSet(id: number, state: TurnoutState): Promise<void> {
        return new Promise<void>((resolve) => {
            let numericState = 0;
            numericState = state === TurnoutState.thrown ? 1 : 0;
            this.socket.emit('turnout/set', id, numericState);
            resolve();
        });
    }

    /**
     * Sets the state of the track power
     * @param state Power state to set
     * @returns A promise that resolves upon completion
     */
    trackPowerSet(state: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            this.socket.emit('track/power', state);
            resolve();
        });
    }
}
