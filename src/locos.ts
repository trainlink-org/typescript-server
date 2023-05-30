/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { adapter } from './index';
import { Loco, LocoStoreBase } from '@trainlink-org/shared-lib';
import type { LocoIdentifier, Direction } from '@trainlink-org/trainlink-types';
import { log } from './logger';
import { dbConnection } from './database';
import { io } from './socket';

import { format as sqlFormat } from 'mysql';

/**
 * A store for multiple Loco objects
 */
export class LocoStore extends LocoStoreBase {
    /**
     *  Adds a {@link Loco} to the LocoStore
     * 	@param loco The {@link Loco} to add to the LocoStore
     */
    add(loco: Loco): void {
        super.add(loco);
        const sql = 'INSERT INTO locos (name, address) VALUES (?,?);';
        const inserts = [loco.name, loco.address];
        dbConnection.query(sqlFormat(sql, inserts), (error, results) => {
            if (error) throw error;
            log(results);
        });
    }

    /**
     * Fetches a specified {@link Loco} from the store
     * @param identifier Identifier of the {@link Loco} to fetch
     * @param sync The extent any changes to the loco should be synced
     * @returns A promise that resolves to the loco requested
     */
    getLoco(identifier: LocoIdentifier, sync = SyncLevel.All): Promise<Loco> {
        return new Promise<Loco>((resolve, reject) => {
            const loco = this.getLocoFromIdentifier(identifier);
            if (loco && sync !== SyncLevel.None) {
                resolve(new ProxyLoco(loco, this, sync));
            } else if (loco && sync === SyncLevel.None) {
                resolve(loco);
            } else {
                reject('Loco not found in store');
            }
        });
    }

    /**
     * Deletes a {@link Loco} from the store
     * @param identifier The identifier of the {@link Loco} to delete
     * @returns true if successful, false if not
     */
    deleteLoco(identifier: LocoIdentifier): boolean {
        const loco = this.getLocoFromIdentifier(identifier);
        if (loco !== undefined) {
            const isSuccessful =
                this.nameStore.delete(loco.name) &&
                this.objectStore.delete(loco.address);
            if (isSuccessful) {
                const sql = 'DELETE FROM locos WHERE address = ?';
                const inserts = [loco.address];
                dbConnection.query(
                    sqlFormat(sql, inserts),
                    (error, results) => {
                        if (error) throw error;
                        log(results);
                    }
                );
                return true;
            }
            return false;
        }
        return false;
    }

    /**
     * Updates a {@link Loco} in the store
     * @param identifier The identifier of the {@link Loco} to update
     * @param name The new name for the Loco
     * @param address The new address for the Loco
     */
    updateLoco(identifier: LocoIdentifier, name?: string, address?: number) {
        const loco = this.getLocoFromIdentifier(identifier);
        if (loco) {
            name ??= loco.name;
            address ??= loco.address;

            const newLoco = new Loco(name, address);
            newLoco.speed = loco.speed;
            newLoco.direction = loco.direction;

            this.objectStore.delete(loco.address);
            this.nameStore.delete(loco.name);

            this.objectStore.set(newLoco.address, newLoco);
            this.nameStore.set(newLoco.name, newLoco.address);

            const sql = 'SELECT idlocos FROM locos WHERE address = ?;';
            const inserts = [loco.address];
            dbConnection.query(sqlFormat(sql, inserts), (error, results) => {
                if (error) throw error;
                log(results[0].idlocos);
                const sql =
                    'UPDATE locos SET name = ?, address = ? WHERE idlocos = ?;';
                const inserts = [
                    newLoco.name,
                    newLoco.address,
                    results[0].idlocos,
                ];
                dbConnection.query(
                    sqlFormat(sql, inserts),
                    (error, results) => {
                        if (error) throw error;
                        log(results);
                    }
                );
            });
        }
    }

    /**
     * Loads any Locos saved to persistent storage.
     * Any Locos found are added to the LocoStore.
     * @returns A promise that resolves once complete
     */
    loadSave(): Promise<void> {
        return new Promise<void>((resolve) => {
            interface Result {
                idlocos: number;
                name: string;
                address: number;
                description: string;
            }
            dbConnection.query(
                'SELECT * FROM locos',
                (error, results: Result[]) => {
                    if (error) throw error; // TODO Probably should be improved
                    for (const result of results) {
                        if (!this.objectStore.has(result.address)) {
                            super.add(new Loco(result.name, result.address));
                        }
                    }
                    resolve();
                }
            );
        });
    }

    /**
     * Called by {@link ProxyLoco} to sync changes to a loco with all clients and the console
     * @param proxyLoco The loco to sync
     * @param socketSync Whether to sync with clients
     */
    syncLoco(proxyLoco: ProxyLoco, socketSync: SyncLevel) {
        const loco = this.getLocoFromIdentifier(proxyLoco.address);
        if (loco) {
            if (
                socketSync === SyncLevel.All ||
                socketSync === SyncLevel.ClientOnly
            ) {
                io.emit(
                    'throttle/speedUpdate',
                    loco.address,
                    loco.speed,
                    '',
                    -1
                );
                io.emit(
                    'throttle/directionUpdate',
                    loco.address,
                    loco.direction
                );
            }
            if (
                socketSync === SyncLevel.All ||
                socketSync === SyncLevel.SerialOnly
            ) {
                //TODO implement error handling
                void adapter.locoSetSpeed(
                    loco.address,
                    loco.speed,
                    loco.direction
                );
            }
        }
    }
}

/**
 * Returned by the {@link LocoStore} to facilitate syncing
 */
class ProxyLoco extends Loco {
    public store: LocoStore;
    private _socketSync: SyncLevel;

    constructor(loco: Loco, store: LocoStore, sync = SyncLevel.All) {
        super(loco.name, loco.address);
        this._speed = loco.speed;
        this._direction = loco.direction;
        this.store = store;
        this._socketSync = sync;
    }

    set speed(newSpeed: number) {
        super.speed = newSpeed;
        //TODO implement error handling
        void this.store.getLoco(this.address, SyncLevel.None).then((loco) => {
            loco.speed = newSpeed;
            this.store.syncLoco(this, this._socketSync);
        });
    }

    get speed() {
        return super.speed;
    }

    set direction(direction: Direction) {
        super.direction = direction;
        //TODO implement error handling
        void this.store.getLoco(this.address, SyncLevel.None).then((loco) => {
            loco.direction = direction;
            this.store.syncLoco(this, this._socketSync);
        });
    }

    get direction() {
        return this._direction;
    }
}

export enum SyncLevel {
    None,
    SerialOnly,
    ClientOnly,
    All,
}
