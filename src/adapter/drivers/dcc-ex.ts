import type { DeviceDriver } from '../drivers';
import { ReadlineParser, SerialPort } from 'serialport';

/**
 * Used to interface with DCC-EX command stations
 */
export class DCCExDriver implements DeviceDriver {
    readonly name = 'DCC-EX';
    private _port: SerialPort;
    private _parser: ReadlineParser;

    /**
     * Used to interface with DCC-EX command stations
     * @param serialPort The serial port to connect to the CS on
     * @param callback Called once the CS is connected
     */
    constructor(serialPort: string, callback: () => void) {
        console.log('Dcc ex driver');
        this._port = new SerialPort({
            path: serialPort,
            baudRate: 115200,
        });
        this._parser = new ReadlineParser();
        this._setup(serialPort, callback);
    }

    private async _setup(serialPort: string, callback: () => void) {
        this._port.pipe(this._parser);
        await this._awaitStartupInfo();
        callback();
        this._parser.on('data', (data) => {
            console.log('Rx [' + data.toString() + ']');
        });
    }

    private _awaitStartupInfo(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._parser.on('data', (data) => {
                if (data.toString().slice(0, 2) === '<i') {
                    resolve();
                }
            });
        });
    }

    setSpeed(address: number, speed: number, direction: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<t 1 ${address} ${speed} ${direction}>`;
            console.log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    emergencyStop(address: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<t 1 ${address} -1 1>`;
            console.log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    setTrackPower(state: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<${Number(state)}>`;
            console.log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    setTurnoutState(turnoutID: number, state: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const packet = `<T ${turnoutID} ${state}>`;
            console.log('Tx [' + packet + ']');
            this._port.write(packet);
            resolve();
        });
    }

    close(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._port.close();
            console.log('Driver closed');
            resolve();
        });
    }
}
