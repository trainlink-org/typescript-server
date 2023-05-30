import type { AutomationCommand, Scope } from '../types';

import { Direction } from '@trainlink-org/trainlink-types';

/**
 * Implements the ESTOP command
 */
export class estop implements AutomationCommand {
    params = [];
    static params = [];

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

        // Actually executes the command
        return new Promise<void>((resolve) => {
            if (scope.loco) {
                console.log(`Estop loco ${scope.loco.address}`);
                scope.loco.direction = Direction.stopped;
                scope.loco.speed = 0;
            }
            resolve();
        });
    }

    toString(): string {
        return 'ESTOP';
    }
}

/**
 * Implements the FWD command
 */
export class fwd implements AutomationCommand {
    private _newSpeed: number;
    params = ['number'];
    static params = ['number'];

    constructor(speedChange: number) {
        this._newSpeed = speedChange;
    }

    async execute(scope: Scope): Promise<void> {
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
        return new Promise<void>((resolve) => {
            if (scope.loco) {
                if (this._newSpeed === -1) {
                    new estop().execute(scope);
                } else {
                    console.log(
                        `Move loco ${scope.loco.address} forward at speed ${this._newSpeed}`
                    );
                    scope.loco.direction = Direction.forward;
                    scope.loco.speed = this._newSpeed;
                }
            }
            resolve();
        });
    }

    toString(): string {
        return `FWD(${this._newSpeed})`;
    }
}

/**
 * Implements the REV command
 */
export class rev implements AutomationCommand {
    private _newSpeed: number;
    params = ['number'];
    static params = ['number'];

    constructor(speedChange: number) {
        this._newSpeed = speedChange;
    }

    async execute(scope: Scope): Promise<void> {
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
        return new Promise<void>((resolve) => {
            if (scope.loco) {
                if (this._newSpeed === -1) {
                    new estop().execute(scope);
                } else {
                    console.log(
                        `Move loco ${scope.loco.address} forward at speed ${this._newSpeed}`
                    );
                    scope.loco.direction = Direction.reverse;
                    scope.loco.speed = this._newSpeed;
                }
            }
            resolve();
        });
    }

    toString(): string {
        return `REV(${this._newSpeed})`;
    }
}

/**
 * Implements the SPEED command
 */
export class speed implements AutomationCommand {
    private _newSpeed: number;
    params = ['number'];
    static params = ['number'];

    constructor(speed: number) {
        this._newSpeed = speed;
    }

    async execute(scope: Scope): Promise<void> {
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
        scope.currentCommand = [''];
        return new Promise<void>((resolve) => {
            if (scope.loco) {
                console.log(
                    `Move loco ${scope.loco.address} at speed ${this._newSpeed}`
                );
                scope.loco.speed = this._newSpeed;
            }
            resolve();
        });
    }

    toString(): string {
        return `SPEED(${this._newSpeed})`;
    }
}

/**
 * Implements the stop command
 */
export class stop implements AutomationCommand {
    params = [];
    static params = [];

    async execute(scope: Scope): Promise<void> {
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
        scope.currentCommand = [''];
        return new Promise<void>((resolve) => {
            if (scope.loco) {
                console.log(`Stopping loco ${scope.loco.address}`);
                scope.loco.speed = 0;
            }
            resolve();
        });
    }

    toString(): string {
        return 'STOP';
    }
}

/**
 * Implements the FON command
 */
export class fon implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    fnNum: number;

    constructor(fnNum: number) {
        this.fnNum = fnNum;
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
            if (scope.loco) {
                scope.loco.setFunction(this.fnNum, true);
            }
            resolve();
        });
    }

    toString(): string {
        return `FON(${this.fnNum})`;
    }
}

/**
 * Implements the FOFF command
 */
export class foff implements AutomationCommand {
    params = ['number'];
    static params = ['number'];

    fnNum: number;

    constructor(fnNum: number) {
        this.fnNum = fnNum;
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
            if (scope.loco) {
                scope.loco.setFunction(this.fnNum, false);
            }
            resolve();
        });
    }

    toString(): string {
        return `FOFF(${this.fnNum})`;
    }
}
