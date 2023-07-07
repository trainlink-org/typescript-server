import type { AutomationCommand, Scope } from '../types';
import { log } from '../../logger';

import { TurnoutState } from '@trainlink-org/trainlink-types';

/**
 * Implements the THROW command
 */
export class throwTurnout implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private _id: number;

    constructor(id: number) {
        this._id = id;
    }

    async execute(scope: Scope): Promise<void> {
        // Checks if the automation is paused or stopped
        if (scope.stopped) {
            return;
        }
        if (scope.bus) {
            if (!scope.running)
                await new Promise((resolve) =>
                    scope.bus?.once('running', resolve)
                );
        }
        scope.commandStartTime.push(new Date());
        scope.currentCommand = [this.toString()];

        // Actually executes the function
        return new Promise<void>((resolve) => {
            log(`Throw point ${this._id}`);
            scope.turnouts.setTurnout(this._id, TurnoutState.thrown);
            resolve();
        });
    }

    toString(): string {
        return `THROW(${this._id})`;
    }
}

/**
 * Implements the CLOSE command
 */
export class closeTurnout implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private _id: number;

    constructor(id: number) {
        this._id = id;
    }

    async execute(scope: Scope): Promise<void> {
        // Checks if the automation is paused or stopped
        if (scope.stopped) {
            return;
        }
        if (scope.bus) {
            if (!scope.running)
                await new Promise((resolve) =>
                    scope.bus?.once('running', resolve)
                );
        }
        scope.commandStartTime.push(new Date());
        scope.currentCommand = [this.toString()];

        // Actually executes the function
        return new Promise<void>((resolve) => {
            log(`Close point ${this._id}`);
            scope.turnouts.setTurnout(this._id, TurnoutState.closed);
            resolve();
        });
    }

    toString(): string {
        return `CLOSE(${this._id})`;
    }
}

/**
 * Implements the IFTHROWN command
 */
export class ifThrown implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private _id: number;
    children: AutomationCommand[];

    constructor(id: number, children: AutomationCommand[]) {
        this._id = id;
        this.children = children;
    }

    async execute(scope: Scope): Promise<void> {
        // Checks if the automation is paused or stopped
        if (scope.stopped) {
            return;
        }
        if (scope.bus) {
            if (!scope.running)
                await new Promise((resolve) =>
                    scope.bus?.once('running', resolve)
                );
        }
        scope.commandStartTime.push(new Date());
        scope.currentCommand = [this.toString()];

        // Actually executes the function
        return new Promise<void>((resolve) => {
            scope.turnouts
                .getTurnout(this._id)
                .then(async (turnout) => {
                    if (turnout.state === TurnoutState.thrown) {
                        for (const child of this.children) {
                            await child.execute(scope);
                        }
                        resolve();
                    }
                })
                .catch();
            resolve();
        });
    }

    toString(): string {
        return `IFTHROWN(${this._id})\n    ${this.children.join(
            '\n    '
        )}\n    ENDIF`;
    }
}

/**
 * Implements the IFCLOSED command
 */
export class ifClosed implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private _id: number;
    children: AutomationCommand[];

    constructor(id: number, children: AutomationCommand[]) {
        this._id = id;
        this.children = children;
    }

    async execute(scope: Scope): Promise<void> {
        // Checks if the automation is paused or stopped
        if (scope.stopped) {
            return;
        }
        if (scope.bus) {
            if (!scope.running)
                await new Promise((resolve) =>
                    scope.bus?.once('running', resolve)
                );
        }
        scope.commandStartTime.push(new Date());
        scope.currentCommand = [this.toString()];

        // Actually executes the function
        return new Promise<void>((resolve) => {
            scope.turnouts
                .getTurnout(this._id)
                .then(async (turnout) => {
                    if (turnout.state === TurnoutState.closed) {
                        for (const child of this.children) {
                            await child.execute(scope);
                        }
                        resolve();
                    }
                })
                .catch();
            resolve();
        });
    }

    toString(): string {
        return `IFCLOSED(${this._id})\n    ${this.children.join(
            '\n    '
        )}\n    ENDIF`;
    }
}
