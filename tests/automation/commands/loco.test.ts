import { Loco } from '@trainlink-org/trainlink-types';
import { fwd } from '@/src/automation/commands';
import { Scope } from '@/src/automation/types';
// import { turnoutMap } from '@/src';
import { TurnoutMap } from '@/src/turnouts';

describe('Test fwd command', () => {
    test('change speed', async () => {
        const cmd = new fwd(10);
        const loco = new Loco();
        // const turnoutMap = new TurnoutMap();
        // const scope = new Scope(turnoutMap, loco);
        // expect(scope.loco?.speed).toBe(0);
        // await cmd.execute(scope);
        // expect(scope.loco?.speed).toBe(10);
    });
});
