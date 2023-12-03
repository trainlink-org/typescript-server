import type { HardwareAdapter } from '../index';
import { DeviceDriver } from '../drivers';
import { ReadlineParser, SerialPort } from 'serialport';
import type { HardwareDevice } from '@trainlink-org/trainlink-types';

import { log } from '../../logger';

/**
 * Used to interface with DCC-EX command stations
 */
export class DCCExDriver extends DeviceDriver {
    // readonly name = 'DCC-EX';
    // private _message = '';
    private _port: SerialPort;
    private _parser: ReadlineParser;
    private _adapter: HardwareAdapter;
    private _driverChangedCallback: (adapter: HardwareAdapter) => void;

    get message() {
        return this._message;
    }

    /**
     * Used to interface with DCC-EX command stations
     * @param serialPort The serial port to connect to the CS on
     * @param adapter The parent hardware adapter
     * @param driverChangedCallback to be called any time the driverMsg changes
     * @param callback Called once the CS is connected
     */
    constructor(
        serialPort: string,
        adapter: HardwareAdapter,
        driverChangedCallback: (adapter: HardwareAdapter) => void,
        callback: () => void,
    ) {
        super('DCC-EX');
        log('DCC-EX driver');
        this._port = new SerialPort({
            path: serialPort,
            baudRate: 115200,
        });
        this._parser = new ReadlineParser();
        this._setup(serialPort, callback);
        this._adapter = adapter;
        this._driverChangedCallback = driverChangedCallback;
    }

    static getDevices(): Promise<HardwareDevice[]> {
        return SerialPort.list().then((devices) => {
            return devices
                .filter((device) => {
                    return device.serialNumber !== undefined;
                })
                .map((device): HardwareDevice => {
                    return {
                        name:
                            DEVICE_LOOKUP.get(
                                `${device.vendorId}${device.productId}`,
                            ) || `Serial Device ${device.path}`,
                        address: device.path,
                        driver: 'DCC-EX',
                        manufacturer: device.manufacturer,
                        serialNumber: device.serialNumber,
                    };
                });
        });
    }

    private async _setup(serialPort: string, callback: () => void) {
        this._port.pipe(this._parser);
        this._message = await this._awaitStartupInfo();
        this._message = this._message.substring(2, this._message.length - 1);
        this._driverChangedCallback(this._adapter);
        callback();
        // log(this._message);
        this._parser.on('data', (data) => {
            log('Rx [' + data.toString() + ']');
        });
    }

    private _awaitStartupInfo(): Promise<string> {
        return new Promise<string>((resolve) => {
            this._parser.on('data', (data) => {
                if (data.toString().slice(0, 2) === '<i') {
                    // this._message = data.toString();
                    resolve(data.toString());
                }
            });
        });
    }

    setSpeed(address: number, speed: number, direction: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<t 1 ${address} ${speed} ${direction}>`;
            log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    emergencyStop(address: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<t 1 ${address} -1 1>`;
            log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    setTrackPower(state: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<${Number(state)}>`;
            log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    setTurnoutState(turnoutID: number, state: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<T ${turnoutID} ${state}>`;
            log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._port.close();
            log('Driver closed');
            resolve();
        });
    }
}

const DEVICE_LOOKUP = new Map<string, string>([['23410042', 'Arduino Mega']]);
