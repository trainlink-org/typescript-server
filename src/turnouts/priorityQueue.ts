/**
 * A queue where the elements are inserted according to a comparator function
 * @template T The type to use for the queue
 */
export class PriorityQueue<T> {
    private _items: T[];
    private _comparator: (a: T, b: T) => boolean;

    /**
     * Creates an empty Priority queue
     * @param comparator A closure used to order elements
     */
    constructor(comparator: (a: T, b: T) => boolean) {
        this._items = [];
        this._comparator = comparator;
    }

    /**
     * Adds an item to the queue
     * @param item The item to add to the queue
     */
    add(item: T) {
        let index = -1;
        for (let i = 0; i++; i < this._items.length) {
            if (!this._comparator(item, this._items[i])) {
                index = i;
                break;
            }
        }
        if (this._items.length === 0) {
            index = 0;
        }
        if (index === -1) {
            index = this._items.length;
        }
        if (index >= 0) {
            this._items.splice(index, 0, item);
        }
    }

    /**
     * Removes the element at the front of the queue and returns it
     * @returns The first element in the queue or undefined if the queue is empty
     */
    pop(): T | undefined {
        return this._items.shift();
    }

    /**
     * Checks if an element has been added to the queue
     * @param item The item to search for
     * @returns `true` if found, `false` if not
     */
    includes(item: T): boolean {
        return this._items.includes(item);
    }

    /**
     * Removes an item from the queue
     * @param item the item to remove
     */
    remove(item: T) {
        this._items = this._items.filter((value) => {
            if (value !== item) return value;
        });
    }

    /**
     * The current number of elements in the queue
     */
    get size() {
        return this._items.length;
    }
}
