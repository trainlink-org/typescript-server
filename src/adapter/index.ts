import { Direction, TurnoutState } from '@trainlink-org/trainlink-types';
import {
    VirtualDriver,
    AvailableDrivers,
    type DeviceDriver,
    DCCExDriver,
} from './drivers';

export enum DriverStatus {
    Available,
    Switching,
    Unavailable,
}

export class HardwareAdapter {
    private _driver: DeviceDriver;
    private _driverStatus: DriverStatus;
    private _driverChangedCallback: (adapter: HardwareAdapter) => void;

    constructor(driverChangedCallback: (adapter: HardwareAdapter) => void) {
        this._driver = new VirtualDriver();
        this._driverStatus = DriverStatus.Available;
        this._driverChangedCallback = driverChangedCallback;
    }

    selectDriver(driver: AvailableDrivers, address?: string) {
        console.log(`Switching to ${driver}`);
        this._driverStatus = DriverStatus.Switching;
        this._driver.close();
        if (address === undefined) {
            console.log('Address undefined');
            this._driver = new VirtualDriver();
        } else {
            switch (driver) {
                case AvailableDrivers.VirtualDriver:
                    this._driver = new VirtualDriver();
                    this._driverStatus = DriverStatus.Available;
                    break;
                case AvailableDrivers.DCCExDriver:
                    this._driver = new DCCExDriver(
                        address,
                        this,
                        this._driverChangedCallback,
                        () => {
                            this._driverStatus = DriverStatus.Available;
                        }
                    );
                    break;
                default:
                    this._driver = new VirtualDriver();
                    this._driverStatus = DriverStatus.Available;
                    break;
            }
        }
        this._driverChangedCallback(this);
    }

    get driverStatus() {
        return this._driverStatus;
    }

    get driverName() {
        return this._driver.name;
    }

    get driverMsg() {
        return '';
    }

    locoSetSpeed(
        address: number,
        speed: number,
        direction: Direction
    ): Promise<void> {
        return this.waitTillDriverAvailable().then(() => {
            return this._driver.setSpeed(
                address,
                speed,
                directionToNum(direction)
            );
        });
    }

    locoEstop(address: number): Promise<void> {
        return this.waitTillDriverAvailable().then(() => {
            return this._driver.emergencyStop(address);
        });
    }

    turnoutSet(id: number, state: TurnoutState): Promise<void> {
        return this.waitTillDriverAvailable().then(() => {
            return this._driver.setTurnoutState(id, turnoutStateToNum(state));
        });
    }

    trackPowerSet(state: boolean): Promise<void> {
        return this.waitTillDriverAvailable().then(() => {
            return this._driver.setTrackPower(state);
        });
    }

    waitTillDriverAvailable(): Promise<void> {
        return new Promise<void>((resolve) => {
            setInterval(() => {
                if (this._driverStatus === DriverStatus.Available) resolve();
            }, 5);
        });
    }
}

/**
 * Converts a direction to a number to use with hardware
 * @param direction The direction to convert
 * @returns The number output
 */
function directionToNum(direction: Direction): number {
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
 * Converts a TurnoutState to a number to use with hardware
 * @param turnoutState The {@link TurnoutState} to convert
 * @returns The number output
 */
function turnoutStateToNum(turnoutState: TurnoutState): number {
    switch (turnoutState) {
        case TurnoutState.thrown:
            return 1;
        case TurnoutState.closed:
            return 0;
    }
}
