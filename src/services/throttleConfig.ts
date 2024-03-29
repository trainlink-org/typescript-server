import { Loco } from '@trainlink-org/trainlink-types';
import { io } from '../socket';
import type { LocoStore } from '../locos';

/**
 * Creates a new loco, adds it to the store and notifies all clients
 * @param store The LocoStore instance
 * @param name The name of the loco to add
 * @param address The address of the loco to add
 */
export function addLoco(store: LocoStore, name: string, address: number) {
    store.add(new Loco(name, address));
    io.emit('config/newLocoAdded', JSON.stringify(new Loco(name, address)));
}

/**
 * Edits a loco in the LocoStore
 * @param store The LocoStore instance
 * @param oldAddress The old address of the loco
 * @param newAddress The new address of the loco
 * @param name The new name for the loco
 */
export function editLoco(
    store: LocoStore,
    oldAddress: number,
    newAddress: number,
    name: string,
) {
    store.updateLoco(oldAddress, name, newAddress);
    io.emit('config/locoEdited', oldAddress, newAddress, name);
}

/**
 * Deletes a loco from the store
 * @param store The LocoStore instance
 * @param address The address of the loco to delete
 */
export function deleteLoco(store: LocoStore, address: number) {
    store.deleteLoco(address);
    io.emit('config/locoDeleted', address);
}
