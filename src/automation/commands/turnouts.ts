import { AutomationCommand, Scope } from '../types';

import { TurnoutState } from '@trainlink-org/trainlink-types';

/**
 * Implements the THROW command
 */
export class throwTurnout implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private id: number;

    constructor(id: number) {
        this.id = id;
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
            console.log(`Throw point ${this.id}`);
            scope.turnouts.setTurnout(this.id, TurnoutState.thrown);
            resolve();
        });
    }

    toString(): string {
        return `THROW(${this.id})`;
    }
}

/**
 * Implements the CLOSE command
 */
export class closeTurnout implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private id: number;

    constructor(id: number) {
        this.id = id;
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
            console.log(`Close point ${this.id}`);
            scope.turnouts.setTurnout(this.id, TurnoutState.closed);
            resolve();
        });
    }

    toString(): string {
        return `CLOSE(${this.id})`;
    }
}

/**
 * Implements the IFTHROWN command
 */
export class ifThrown implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    private id: number;
    children: AutomationCommand[];

    constructor(id: number, children: AutomationCommand[]) {
        this.id = id;
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
                .getTurnout(this.id)
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
        return `IFTHROWN(${this.id})\n    ${this.children.join(
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

    private id: number;
    children: AutomationCommand[];

    constructor(id: number, children: AutomationCommand[]) {
        this.id = id;
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
                .getTurnout(this.id)
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
        return `IFCLOSED(${this.id})\n    ${this.children.join(
            '\n    '
        )}\n    ENDIF`;
    }
}
