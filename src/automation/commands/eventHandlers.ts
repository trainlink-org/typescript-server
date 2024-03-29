import type {
    AutomationCommand,
    AutomationScript,
    Scope,
    EventHandler,
    HandlerJumpTable,
} from '../types';

import {
    AutomationType,
    EventHandlerType,
} from '@trainlink-org/trainlink-types';

/**
 * Implements the ONCLOSE command
 */
export class onClose implements AutomationScript, EventHandler {
    id = -1;
    name = 'ONCLOSE';
    description = 'Add a description';
    source = '';
    params = ['number'];
    static params = ['number'];
    type = AutomationType.eventHandler;
    children: AutomationCommand[];
    scope: Scope | null;
    eventHandlerType = EventHandlerType.turnout;
    private _turnoutID: number;

    constructor(turnoutID: number, children: AutomationCommand[]) {
        this.children = children;
        this._turnoutID = turnoutID;
        this.scope = null;
    }

    async execute(scope: Scope) {
        for (const child of this.children) {
            await child.execute(scope);
        }
    }

    registerEventHandler(table: HandlerJumpTable) {
        table.turnouts.close.set(this._turnoutID, this);
    }

    toString() {
        return `ONCLOSE(${this._turnoutID})\n    ${this.children.join(
            '\n    ',
        )}\n    DONE`;
    }

    createSource(): void {
        this.source = this.toString();
    }
}

/**
 * Implements the ONTHROWN command
 */
export class onThrow implements AutomationScript, EventHandler {
    id = -2;
    name = 'ONTHROW';
    description = 'Add a description';
    source = '';
    params = ['number'];
    static params = ['number'];
    type = AutomationType.eventHandler;
    children: AutomationCommand[];
    scope: Scope | null;
    eventHandlerType = EventHandlerType.turnout;
    private _turnoutID: number;

    constructor(turnoutID: number, children: AutomationCommand[]) {
        this.children = children;
        this._turnoutID = turnoutID;
        this.scope = null;
    }

    async execute(scope: Scope) {
        for (const child of this.children) {
            await child.execute(scope);
        }
    }

    registerEventHandler(table: HandlerJumpTable) {
        table.turnouts.throw.set(this._turnoutID, this);
    }

    toString() {
        return `ONTHROW(${this._turnoutID})\n    ${this.children.join(
            '\n    ',
        )}\n    DONE`;
    }

    createSource(): void {
        this.source = this.toString();
    }
}
