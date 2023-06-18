// import { store } from '../index';

import type { LocoStore } from '../locos';

/**
 * Validates if a new loco name is valid
 * @param name The name to validate
 * @returns True if valid, False if not
 */
export async function validateName(
    name: string,
    store: LocoStore
): Promise<boolean> {
    console.log(`Validating name (${name})`);
    // Start by assuming input is valid, set to invalid if it fails a condition
    let isCorrect = true;
    // Check if the name is empty
    if (name === '') {
        isCorrect = false;
    }
    // Check if the name is taken
    if (
        await new Promise<boolean>((resolve) => {
            store
                .getLoco(name)
                .then(() => resolve(true))
                .catch(() => resolve(false));
        })
    ) {
        isCorrect = false;
    }
    if (!isCorrect) {
        console.log('Name validation failed');
    }
    return isCorrect;
}

/**
 * Validates if a new loco address is valid
 * @param address The address to validate
 * @returns True if valid, False if not
 */
export async function validateAddress(
    address: number,
    store: LocoStore
): Promise<boolean> {
    console.log(`Validating address (${address})`);
    let isCorrect = true;
    if (isNaN(address)) {
        isCorrect = false;
    }
    if (address <= 0 || address > 10293) {
        isCorrect = false;
    }
    if (
        await new Promise<boolean>((resolve) => {
            store
                .getLoco(address)
                .then(() => resolve(true))
                .catch(() => resolve(false));
        })
    ) {
        isCorrect = false;
    }
    if (!isCorrect) {
        console.log('Address validation failed');
    }
    return isCorrect;
}

/**
 * Validates if a edited loco's current address is valid
 * @param address The address to validate
 * @returns True if valid, False if not
 */
export async function validateCurrentAddress(
    address: number,
    store: LocoStore
): Promise<boolean> {
    console.log(`Validating current address (${address})`);
    let isCorrect = true;
    if (isNaN(address)) {
        isCorrect = false;
    }
    if (address <= 0 || address > 10293) {
        isCorrect = false;
    }
    if (
        !(await new Promise<boolean>((resolve) => {
            store
                .getLoco(address)
                .then(() => resolve(true))
                .catch(() => resolve(false));
        }))
    ) {
        isCorrect = false;
    }
    if (!isCorrect) {
        console.log('Current address validation failed');
    }
    return isCorrect;
}

/**
 * Validates if edits made to a loco are valid
 * @param oldAddress The old address of the loco
 * @param newName The new name for the loco
 * @param newAddress The new address for a loco
 * @returns True if valid, False if not
 */
export async function validateUpdatedLoco(
    oldAddress: number,
    newName: string,
    newAddress: number,
    store: LocoStore
): Promise<boolean> {
    if (oldAddress !== newAddress) {
        if (
            !(await validateAddress(newAddress, store)) ||
            !(await validateCurrentAddress(oldAddress, store))
        ) {
            return false;
        }
    }
    if (
        await new Promise<boolean>((resolve) =>
            store
                .getLoco(oldAddress)
                .then((loco) => resolve(loco.name !== newName))
                .catch(() => resolve(true))
        )
    ) {
        if (!(await validateName(newName, store))) {
            return false;
        }
    }

    return true;
}
