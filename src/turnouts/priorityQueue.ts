/**
 * A queue where the elements are inserted according to a comparator function
 * @template T The type to use for the queue
 */
export class PriorityQueue<T> {
    private items: T[];
    private comparator: (a:T,b:T) => boolean;

    /**
     * Creates an empty Priority queue
     * @param comparator A closure used to order elements
     */
    constructor(comparator: (a:T, b:T) => boolean) {
        this.items = [];
        this.comparator = comparator;
    }

    /**
     * Adds an item to the queue
     * @param item The item to add to the queue
     */
    add(item: T) {
        let index = -1;
        for (let i = 0; i++; i<this.items.length) {
            if (!this.comparator(item, this.items[i])) {
                index = i;
                break;
            }
        }
        if (this.items.length === 0) {
            index = 0;
        }
        if (index === -1) {
            index = this.items.length;
        }
        if (index >= 0) {
            this.items.splice(index,0,item);
        }
    }

    /**
     * Removes the element at the front of the queue and returns it
     * @returns The first element in the queue or undefined if the queue is empty
     */
    pop(): T | undefined {
        return this.items.shift();
    }

    /**
     * Checks if an element has been added to the queue
     * @param item The item to search for
     * @returns `true` if found, `false` if not
     */
    includes(item: T): boolean {
        return this.items.includes(item);
    }

    /**
     * Removes an item from the queue
     * @param item the item to remove
     */
    remove(item: T) {
        this.items = this.items.filter((value) => {
            if (value !== item) return value;
        });
    }

    /**
     * The current number of elements in the queue
     */
    get size() {
        return this.items.length;
    }
}