import type { EventEmitter } from 'events';
import type { TurnoutMap } from '../turnouts';

import {
    AutomationType,
    type AutomationScriptClient,
    EventHandlerType,
    type Loco,
} from '@trainlink-org/trainlink-types';

/**
 * Stores a symbol between the lexer and the parser
 */
export interface IntermediateSymbol {
    name: string;
    args: string[];
}

/**
 * Allows running automations to access the data they need
 */
export class Scope {
    private _pid = 0;
    private _locoSpeed = 0;
    running = false;
    stopped = false;
    bus: EventEmitter | undefined;
    loco?: Loco;
    commandStartTime: Date[] = [];
    currentCommand = [''];
    currentCommandParam = [''];
    turnouts: TurnoutMap;

    constructor(turnouts: TurnoutMap, loco?: Loco) {
        this.turnouts = turnouts;
        this.loco = loco;
    }
}

/**
 * Common interface for any command
 */
export interface AutomationCommand {
    children?: AutomationCommand[];
    execute(scope: Scope): Promise<void>;
    toString(): string;
    params: string[];
}

/**
 * Common interface for base commands
 */
export interface AutomationScript
    extends AutomationCommand,
        AutomationScriptClient {
    scope: Scope | null;
    createSource(): void;
    eventHandlerType: EventHandlerType;
}

/**
 * Implements the SEQUENCE command
 */
export class Sequence implements AutomationScript {
    id: number;
    name: string;
    description = 'Add a description';
    children: AutomationCommand[];
    scope: Scope | null;
    type: AutomationType = AutomationType.sequence;
    source = '';
    params = ['number'];
    static params = ['number'];
    eventHandlerType = EventHandlerType.none;

    constructor(id: number, name: string, children: AutomationCommand[]) {
        this.id = id;
        this.name = name === '' || name === undefined ? `Sequence ${id}` : name;
        this.children = children;
        this.scope = null;
    }

    async execute(scope: Scope) {
        this.scope = scope;
        for (const child of this.children) {
            await child.execute(scope);
        }
    }

    toString(): string {
        return `SEQUENCE(${this.id})\n    ${this.children.join(
            '\n    ',
        )}\n    DONE`;
    }

    createSource() {
        this.source = this.toString();
    }
}

/**
 * Implements the Route Command
 */
export class Route implements AutomationScript {
    id: number;
    name: string;
    description = 'Add a description';
    children: AutomationCommand[]; //TODO Change this for an actual type
    scope: Scope | null;
    type: AutomationType = AutomationType.route;
    source = '';
    params = ['number', 'string?'];
    static params = ['number', 'string?'];
    eventHandlerType = EventHandlerType.none;

    constructor(id: number, name: string, children: AutomationCommand[]) {
        this.id = id;
        this.name = name === '' || name === undefined ? `Route ${id}` : name;
        this.children = children;
        this.scope = null;
    }

    async execute(scope: Scope) {
        this.scope = scope;
        for (const child of this.children) {
            await child.execute(scope);
        }
    }

    toString(): string {
        return `ROUTE(${this.id}, "${this.name}")\n    ${this.children.join(
            '\n    ',
        )}\n    DONE`;
    }

    createSource() {
        this.source = this.toString();
    }
}

/**
 * Implements the AUTOMATION command
 */
export class Automation implements AutomationScript {
    id: number;
    name: string;
    description = 'Add a description';
    children: AutomationCommand[];
    scope: Scope | null;
    type: AutomationType = AutomationType.automation;
    source = '';
    params = ['number', 'string?'];
    static params = ['number', 'string?'];
    eventHandlerType = EventHandlerType.none;

    constructor(id: number, name: string, children: AutomationCommand[]) {
        this.id = id;
        this.name =
            name === '' || name === undefined ? `Automation ${id}` : name;
        this.children = children;
        this.scope = null;
    }

    async execute(scope: Scope) {
        this.scope = scope;
        for (const child of this.children) {
            await child.execute(scope);
        }
    }

    toString(): string {
        return `AUTOMATION(${this.id}, "${
            this.name
        }")\n    ${this.children.join('\n    ')}\n    DONE`;
    }

    createSource() {
        this.source = this.toString();
    }
}

/**
 * Standard definition of the functionality an event handler should implement
 */
export interface EventHandler {
    eventHandlerType: EventHandlerType;
    registerEventHandler: (table: HandlerJumpTable) => void;
    execute: (scope: Scope) => void;
}

/**
 * Defines the jump table used to find event handlers
 */
export interface HandlerJumpTable {
    turnouts: {
        throw: Map<number, EventHandler>;
        close: Map<number, EventHandler>;
    };
}

/**
 * Checks if an object has the correct properties to be a {@link EventHandler}
 * @param object Object to check
 * @returns True or false
 */
export function isEventHandler(object: unknown): object is EventHandler {
    if (typeof object === 'object' && object) {
        return 'eventHandlerType' in object && 'registerEventHandler' in object;
    }
    return false;
}
