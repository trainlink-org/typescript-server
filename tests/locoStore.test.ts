import { HardwareAdapter } from '@/src/adapter';
import { LocoStore, SyncLevel } from '@/src/locos';
import { Direction, Loco } from '@trainlink-org/trainlink-types';
import { Database, Statement, open } from 'sqlite';
import sqlite from 'sqlite';
import sqlite3 from 'sqlite3';

jest.mock('sqlite');
jest.mock('sqlite3');

const database = new Database({
    driver: sqlite3.Database,
    filename: 'test.db',
});
const mockedDatabase = jest.mocked(database);
// mockedDatabase.run.mockResolvedValue({
//     lastID: 0,
//     stmt: new Statement(new sqlite3.Statement()),
// });
mockedDatabase.run.mockImplementation(async (sql, params) => {
    const stmt = new Statement(new sqlite3.Statement());
    await stmt.bind(params);
    return Promise.resolve({ lastID: 0, stmt: stmt });
});

describe('Test locostore', () => {
    const adapter = new HardwareAdapter(() => {});
    const store = new LocoStore(mockedDatabase, adapter);
    test('Create store', () => {
        expect(Array.from(store.getAllLocos())).toEqual([]);
    });
    test('Add a loco', () => {
        store.add(new Loco('Test', 100));
        expect(Array.from(store.getAllLocos())).toContainEqual(
            new Loco('Test', 100),
        );
    });
    test('Get a loco', async () => {
        store.add(new Loco('Test2', 101));
        expect(store.getLoco(101, SyncLevel.None)).resolves.toEqual(
            new Loco('Test2', 101),
        );
        expect(store.getLoco('Test2', SyncLevel.None)).resolves.toEqual(
            new Loco('Test2', 101),
        );
        expect(store.getLoco('Not in store', SyncLevel.None)).rejects.toEqual(
            'Loco not found in store',
        );
    });
});
