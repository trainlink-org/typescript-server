/**
 * Base type for a hardware driver
 */
export interface DeviceDriver {
    /**
     * Used to identify the driver in use
     */
    name: string;
    message: string;
    /**
     * Sets the speed of a loco
     * @param address Address of the loco
     * @param speed Speed of the loco (0-126)
     * @param direction Direction of the loco (Fwd: 1, Rev: 0)
     */
    setSpeed(address: number, speed: number, direction: number): Promise<void>;
    /**
     * Sends an emergency stop signal to a loco
     * @param address Address of the loco
     */
    emergencyStop(address: number): Promise<void>;
    /**
     * Sets the track power on or off
     * @param state State to set the track power to (true is on)
     */
    setTrackPower(state: boolean): Promise<void>;
    /**
     * Sets the state of a turnout
     * @param turnoutID id of the turnout to set
     * @param state State to set the turnout to
     */
    setTurnoutState(turnoutID: number, state: number): Promise<void>;
    /**
     * Called when the driver is unloaded
     */
    close(): Promise<void>;
}

/**
 * A virtual driver implementation that doesn't actually interface with hardware.
 * Used until a real driver is selected by the client
 */
export class VirtualDriver implements DeviceDriver {
    readonly name = 'Virtual';
    private _notified = false; // Makes sure to only notify the user once, and only if a packet is actually sent
    private _message = '';

    get message() {
        return this._message;
    }

    setSpeed(address: number, speed: number, direction: number): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this._notified) {
                console.log('Using default driver');
                this._notified = true;
            }
            console.log(`SetSpeed => ${address} - ${speed} - ${direction}`);
            resolve();
        });
    }

    emergencyStop(address: number): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this._notified) {
                console.log('Using default driver');
                this._notified = true;
            }
            console.log(`EStop => ${address}`);
            resolve();
        });
    }

    setTrackPower(state: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this._notified) {
                console.log('Using default driver');
                this._notified = true;
            }
            console.log(`TrackPower => ${state}`);
            resolve();
        });
    }

    setTurnoutState(turnoutID: number, state: number): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this._notified) {
                console.log('Using default driver');
                this._notified = true;
            }
            console.log(`SetTurnout => ${turnoutID} - ${state}`);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise<void>((resolve) => {
            console.log('Default driver closing');
            resolve();
        });
    }
}

export enum AvailableDrivers {
    VirtualDriver = 'Virtual',
    DCCExDriver = 'DCC-EX',
}

// Exports the hardware drivers
export { DCCExDriver } from './drivers/dcc-ex';
