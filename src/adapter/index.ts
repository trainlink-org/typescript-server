import { version } from '../index';
import {
    Direction,
    TurnoutState,
    type HardwareAdapter,
} from '@trainlink-org/shared-lib';
import { resolve } from 'path';

import { io, type Socket } from 'socket.io-client';

/**
 * Handles connecting to hardware via a websocket
 */
export class SocketHardwareAdapter implements HardwareAdapter {
    /** Used to communicate with the hardware */
    private _socket: Socket;
    /** Stores the previous packet */
    private _prevPacket = '';

    constructor() {
        // Connect to native connector
        this._socket = io('http://host.docker.internal:3002');
        this._socket.disconnect();
        this._socket.on('connect', () => {
            console.log('Connected');
            this._socket.emit('handshake', version.version);
        });
        this._socket.on('disconnect', (reason) => {
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
            const packet = `${address} ${speed} ${this._directionToNumber(
                direction
            )}`;
            if (packet !== this._prevPacket) {
                if (this._directionToNumber(direction) !== -1) {
                    this._socket.emit(
                        'cab/setSpeed',
                        address,
                        speed,
                        this._directionToNumber(direction)
                    );
                    this._prevPacket = packet;
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
            this._socket.emit('cab/eStop', address);
            resolve();
        });
    }

    /**
     * Converts a direction to a number to use with hardware
     * @param direction The direction to convert
     * @returns The number output
     */
    private _directionToNumber(direction: Direction): number {
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
            this._socket.emit('turnout/set', id, numericState);
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
            this._socket.emit('track/power', state);
            resolve();
        });
    }
}

export class DummyHardwareAdapter implements HardwareAdapter {
    locoSetSpeed(
        address: number,
        speed: number,
        direction: Direction
    ): Promise<void> {
        return new Promise<void>((resolve) => {
            console.log(`${address} - ${speed} @ ${direction}`);
            resolve();
        });
    }

    locoEstop(address: number): Promise<void> {
        return new Promise<void>((resolve) => {
            console.log(`${address}`);
            resolve();
        });
    }

    turnoutSet(id: number, state: TurnoutState): Promise<void> {
        return new Promise<void>((resolve) => {
            console.log(`${id} - ${state}`);
            resolve();
        });
    }

    trackPowerSet(state: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            console.log(`${state}`);
            resolve();
        });
    }
}
