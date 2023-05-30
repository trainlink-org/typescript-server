import { store } from '../index';

/**
 * Validates if a new loco name is valid
 * @param name The name to validate
 * @returns True if valid, False if not
 */
export async function validateName(name: string): Promise<boolean> {
    console.log(`Validating name (${name})`);
    // Start by assuming input is valid, set to invalid if it fails a condition
    let passes = true;
    // Check if the name is empty
    if (name === '') {
        passes = false;
    }
    // Check if the name is taken
    if (await new Promise<boolean>((resolve) => {
        store.getLoco(name).then(() => resolve(true)).catch(() => resolve(false));
    })) {
        passes = false;
    }
    if (!passes) {
        console.log('Name validation failed');
    }
    return passes;
}

/**
 * Validates if a new loco address is valid
 * @param address The address to validate
 * @returns True if valid, False if not
 */
export async function validateAddress(address: number): Promise<boolean> {
    console.log(`Validating address (${address})`);
    let passes = true;
    if (isNaN(address)) {
        passes = false;
    }
    if (address <= 0 || address > 10293) {
        passes = false;
    }
    if (await new Promise<boolean>((resolve) => {
        store.getLoco(address).then(() => resolve(true)).catch(() => resolve(false));
    })) {
        passes = false;
    }
    if (!passes) {
        console.log('Address validation failed');
    }
    return passes;
}

/**
 * Validates if a edited loco's current address is valid
 * @param address The address to validate
 * @returns True if valid, False if not
 */
export async function validateCurrentAddress(address: number): Promise<boolean> {
    console.log(`Validating current address (${address})`);
    let passes = true;
    if (isNaN(address)) {
        passes = false;
    }
    if (address <= 0 || address > 10293) {
        passes = false;
    }
    if (!await new Promise<boolean>((resolve) => {
        store.getLoco(address).then(() => resolve(true)).catch(() => resolve(false));
    })) {
        passes = false;
    }
    if (!passes) {
        console.log('Current address validation failed');
    }
    return passes;
}

/**
 * Validates if edits made to a loco are valid
 * @param oldAddress The old address of the loco
 * @param newName The new name for the loco
 * @param newAddress The new address for a loco
 * @returns True if valid, False if not
 */
export async function validateUpdatedLoco(oldAddress: number, newName: string, newAddress: number): Promise<boolean> {
    if (oldAddress !== newAddress) {
        if (!await validateAddress(newAddress) || !await validateCurrentAddress(oldAddress)){
            return false;
        }
    }
    if (await new Promise<boolean>((resolve) => store.getLoco(oldAddress).then((loco) => resolve(loco.name !== newName)).catch(() => resolve(true)))) {
        if (!await validateName(newName)) {
            return false;
        }
    }

    return true;
}