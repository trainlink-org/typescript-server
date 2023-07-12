import { VirtualDriver } from '@/src/adapter/drivers';

describe('Get devices', () => {
    test('Lists correct device', async () => {
        const devices = await VirtualDriver.getDevices();
        expect(devices).toEqual([
            { name: 'Virtual Device', driver: 'Virtual' },
        ]);
    });
});

describe('Test functionality', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const driver = new VirtualDriver();
    test('Set up correctly', () => {
        expect(driver.name).toBe('Virtual');
        expect(driver.message).toBe('');
    });
    test('Speed change', () => {
        driver.setSpeed(3, 100, 1);
        expect(consoleSpy.mock.calls[0][0]).toBe('SetSpeed => 3 - 100 - 1');
    });
    test('Emergency stop', () => {
        driver.emergencyStop(3);
        expect(consoleSpy.mock.calls[1][0]).toBe('EStop => 3');
    });
    test('Set track power', () => {
        driver.setTrackPower(true);
        expect(consoleSpy.mock.calls[2][0]).toBe('TrackPower => true');
    });
    test('Set turnout state', () => {
        driver.setTurnoutState(2, 1);
        expect(consoleSpy.mock.calls[3][0]).toBe('SetTurnout => 2 - 1');
    });
    test('Close driver', () => {
        driver.close();
        expect(consoleSpy.mock.calls[4][0]).toBe('Virtual driver closing');
    });
});
