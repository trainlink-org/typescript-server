import { log } from '../../logger';
import type { AutomationCommand, Scope } from '../types';

/**
 * Implements the DELAY command
 */
export class delay implements AutomationCommand {
    private _delayLength: number;
    params = ['number'];
    static params = ['number'];

    constructor(delayLength: number) {
        this._delayLength = delayLength;
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
        scope.currentCommand[1] = this.toString();
        return new Promise<void>((resolve) => {
            log(`Pausing for ${this._delayLength}`);
            setTimeout(() => {
                log(`Delay finished (${this._delayLength})`);
                resolve();
            }, this._delayLength);
        });
    }

    toString(): string {
        return `DELAY(${this._delayLength})`;
    }
}
