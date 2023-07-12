import { DeviceDriver } from '@/src/adapter/drivers';

describe('DeviceDriver abstract class', () => {
    test('Static methods', async () => {
        const devices = await DeviceDriver.getDevices();
        expect(devices).toEqual([]);
    });
});
