import { store } from '../index';
import { Loco } from '@trainlink-org/shared-lib';
import { io } from '../socket';

/**
 * Creates a new loco, adds it to the store and notifies all clients
 * @param name The name of the loco to add
 * @param address The address of the loco to add
 */
export function addLoco(name: string, address: number) {
    store.add(new Loco(name, address));
    io.emit('config/newLocoAdded', JSON.stringify(new Loco(name, address)));
}

/**
 * Edits a loco in the LocoStore
 * @param oldAddress The old address of the loco
 * @param newAddress The new address of the loco
 * @param name The new name for the loco
 */
export function editLoco(oldAddress: number, newAddress: number, name: string) {
    store.updateLoco(oldAddress, name, newAddress);
    io.emit('config/locoEdited', oldAddress, newAddress, name);
}

/**
 * Deletes a loco from the store
 * @param address The address of the loco to delete
 */
export function deleteLoco(address: number) {
    store.deleteLoco(address);
    io.emit('config/locoDeleted', address);
}
