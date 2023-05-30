import { AutomationCommand, Scope } from '../types';

/**
 * Implements the DELAY command
 */
export class delay implements AutomationCommand {
    private delayLength: number;
    params = ['number'];
    static params = ['number'];

    constructor(delayLength: number) {
        this.delayLength = delayLength;
    }

    async execute(scope: Scope): Promise<void> {
        if (scope.stopped) {
            return;
        }
        if (scope.bus) {
            if (!scope.running) await new Promise(resolve => scope.bus?.once('running', resolve));
        }
        scope.commandStartTime.push(new Date());
        scope.currentCommand[1] = this.toString();
        return new Promise<void>((resolve) => {
            console.log(`Pausing for ${this.delayLength}`);
            setTimeout(() => {console.log(`Delay finished (${this.delayLength})`);resolve();}, this.delayLength);
        });
    }

    toString(): string {
        return `DELAY(${this.delayLength})`;
    }
}