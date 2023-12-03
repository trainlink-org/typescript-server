import * as commands from './commands';
import { onClose, onThrow } from './commands';
import {
    type IntermediateSymbol,
    type AutomationScript,
    Sequence,
    Route,
    Automation,
    type AutomationCommand,
} from './types';

import {
    AutomationError,
    AutomationErrorType,
} from '@trainlink-org/trainlink-types';

/**
 * Converts an array of string symbols into a script that's actually executable
 * @param input An array of symbols from the lexer
 * @returns An array of automation scripts
 */
export async function parser(
    input: IntermediateSymbol[],
): Promise<AutomationScript[]> {
    const baseObjects: AutomationScript[] = [];
    const takenIds: number[] = [];
    while (input.length !== 0) {
        baseObjects.push(await parseScript(input, takenIds));
    }

    return baseObjects;
}

/**
 * Parses a individual script
 * @param input An array of string symbols
 * @param takenIds The script IDs that are already in use
 * @returns A promise that resolves to an automation script
 */
function parseScript(
    input: IntermediateSymbol[],
    takenIds: number[],
): Promise<AutomationScript> {
    return new Promise<AutomationScript>((resolve, reject) => {
        let baseObject: AutomationScript;
        let level = 0;

        // First select the correct base command
        switch (input[0].name) {
            case 'SEQUENCE':
                verifyParams(
                    `At SEQUENCE(${input[0].args})`,
                    Sequence.params,
                    input[0].args,
                );
                verifyId(
                    Number(input[0].args[0]),
                    takenIds,
                    `At SEQUENCE(${input[0].args})`,
                );
                baseObject = new Sequence(
                    Number(input[0].args[0]),
                    input[0].args[1],
                    [],
                ); //! Will break if id isn't a number
                break;

            case 'ROUTE':
                verifyParams(
                    `At ROUTE(${input[0].args})`,
                    Route.params,
                    input[0].args,
                );
                verifyId(
                    Number(input[0].args[0]),
                    takenIds,
                    `At ROUTE(${input[0].args})`,
                );
                baseObject = new Route(Number(input[0].args[0]), '', []); //! Will break if id isn't a number
                break;

            case 'AUTOMATION':
                verifyParams(
                    `At AUTOMATION(${input[0].args})`,
                    Automation.params,
                    input[0].args,
                );
                verifyId(
                    Number(input[0].args[0]),
                    takenIds,
                    `At AUTOMATION(${input[0].args})`,
                );
                baseObject = new Automation(
                    Number(input[0].args[0]),
                    input[0].args[1],
                    [],
                ); //! Will break if id isn't a number
                break;

            case 'ONCLOSE':
                verifyParams(
                    `AT ONCLOSE(${input[0].args})`,
                    onClose.params,
                    input[0].args,
                );
                baseObject = new onClose(Number(input[0].args), []);
                break;
            case 'ONTHROW':
                verifyParams(
                    `AT ONTHROW(${input[0].args})`,
                    onThrow.params,
                    input[0].args,
                );
                baseObject = new onThrow(Number(input[0].args), []);
                break;

            default:
                baseObject = new Sequence(-1, 'Startup', []);
                break;
        }
        level = 1;
        input.shift();

        // Process the rest of the commands in the script
        const activeObjects = new Stack<AutomationCommand>(baseObject);
        while (level !== 0) {
            const children = activeObjects.peek().children;
            if (children) {
                // Select the command
                switch (input[0].name) {
                    case 'FWD':
                        verifyParams(
                            `At FWD(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.fwd.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.fwd(Number(input[0].args[0])),
                        );
                        break;
                    case 'REV':
                        verifyParams(
                            `At REV(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.rev.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.rev(Number(input[0].args[0])),
                        );
                        break;
                    case 'SPEED':
                        verifyParams(
                            `At SPEED(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.speed.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.speed(Number(input[0].args[0])),
                        );
                        break;
                    case 'FON':
                        verifyParams(
                            `At FON(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.fon.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.fon(Number(input[0].args[0])),
                        );
                        break;
                    case 'FOFF':
                        verifyParams(
                            `At FOFF(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.foff.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.foff(Number(input[0].args[0])),
                        );
                        break;
                    case 'STOP':
                        verifyParams(
                            `At STOP in ${baseObject.type} ${baseObject.id}`,
                            commands.stop.params,
                            input[0].args,
                        );
                        children.push(new commands.stop());
                        break;
                    case 'ESTOP':
                        verifyParams(
                            `At ESTOP in ${baseObject.type} ${baseObject.id}`,
                            commands.estop.params,
                            input[0].args,
                        );
                        children.push(new commands.estop());
                        break;
                    case 'THROW':
                        verifyParams(
                            `At THROW(${input[0].args} in ${baseObject.type} ${baseObject.id}`,
                            commands.throwTurnout.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.throwTurnout(Number(input[0].args[0])),
                        );
                        break;
                    case 'CLOSE':
                        verifyParams(
                            `At CLOSE(${input[0].args} in ${baseObject.type} ${baseObject.id}`,
                            commands.closeTurnout.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.closeTurnout(Number(input[0].args[0])),
                        );
                        break;
                    case 'DELAY':
                        verifyParams(
                            `At DELAY(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.delay.params,
                            input[0].args,
                        );
                        children.push(
                            new commands.delay(Number(input[0].args[0])),
                        );
                        break;
                    case 'DONE':
                        verifyParams(
                            `At DONE(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            [],
                            input[0].args,
                        );
                        level -= 1;
                        activeObjects.pop();
                        break;
                    case 'ENDTASK':
                        verifyParams(
                            `At ENDTASK(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            [],
                            input[0].args,
                        );
                        level -= 1;
                        activeObjects.pop();
                        break;

                    case 'IFTHROWN':
                        verifyParams(
                            `At IFTHROWN(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.ifThrown.params,
                            input[0].args,
                        );
                        level++;
                        children.push(
                            new commands.ifThrown(Number(input[0].args[0]), []),
                        );
                        activeObjects.push(children[children.length - 1]);
                        break;

                    case 'IFCLOSED':
                        verifyParams(
                            `At IFCLOSED(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            commands.ifClosed.params,
                            input[0].args,
                        );
                        level++;
                        children.push(
                            new commands.ifClosed(Number(input[0].args[0]), []),
                        );
                        activeObjects.push(children[children.length - 1]);
                        break;
                    case 'ENDIF':
                        verifyParams(
                            `At ENDIF(${input[0].args}) in ${baseObject.type} ${baseObject.id}`,
                            [],
                            input[0].args,
                        );
                        level--;
                        activeObjects.pop();
                        break;
                    case 'AUTOMATION' || 'SEQUENCE' || 'ROUTE':
                        reject(
                            new AutomationError(
                                AutomationErrorType.syntaxError,
                                'Missing DONE keyword',
                                `At ${baseObject.type} ${baseObject.id}`,
                            ),
                        );
                        break;
                    default:
                        // Command not implemented, check if it should be
                        if (
                            commands.unimplementedCommands.includes(
                                input[0].name,
                            )
                        ) {
                            reject(
                                new AutomationError(
                                    AutomationErrorType.syntaxError,
                                    `The command "${input[0].name}" hasn't been implemented yet so it won't work.`,
                                    `In ${baseObject.type} ${baseObject.id}`,
                                ),
                            );
                        } else {
                            reject(
                                new AutomationError(
                                    AutomationErrorType.syntaxError,
                                    `Unknown command "${input[0].name}" in ${baseObject.type} ${baseObject.id}`,
                                ),
                            );
                        }
                }
            }
            input.shift();
        }

        // Finish up and return
        baseObject.createSource();
        resolve(baseObject);
    });
}

/**
 * Verifies the parameters given compared to the datatypes that should be taken
 * @param location Where the command is in the script, used for errors
 * @param commandParams The datatypes of the parameters the command takes
 * @param params The parameters to verify
 */
function verifyParams(
    location: string,
    commandParams: string[],
    params: string[],
) {
    // Check the lengths match
    if (commandParams.length === 0 && params.length !== 0) {
        throw new AutomationError(
            AutomationErrorType.syntaxError,
            `Unexpected parameters given (${params.length} given but none needed)`,
            location,
        );
    } else if (
        params.length <
            commandParams.filter((value) => {
                return value.slice(-1) !== '?';
            }).length ||
        params.length > commandParams.length
    ) {
        throw new AutomationError(
            AutomationErrorType.syntaxError,
            `Wrong number of arguments given (${params.length} instead of ${commandParams.length})`,
            location,
        );
    }

    // Check the datatypes
    commandParams.forEach((value, index) => {
        if (value.match(/number/g) && isNaN(Number(params[index])))
            throw new AutomationError(
                AutomationErrorType.syntaxError,
                `Incorrect data type for argument ${
                    index + 1
                } (Should be a ${value} but "${params[index]}" was given)`,
                location,
            );
    });
}

/**
 * Verifies the ID is valid
 * @param id The id to verify
 * @param takenIds An array of already used IDs
 * @param location The location in the script, used for errors
 */
function verifyId(id: number, takenIds: number[], location: string) {
    if (takenIds.includes(id)) {
        throw new AutomationError(
            AutomationErrorType.syntaxError,
            `The id ${id} is already being used`,
            location,
        );
    } else {
        takenIds.push(id);
    }
}

/**
 * Basic stack implementation
 */
class Stack<T> {
    private _array: Array<T> = [];
    length = this._array.length;

    constructor(baseObject?: T) {
        if (baseObject !== undefined) {
            this.push(baseObject);
        }
    }

    push(element: T) {
        this._array.push(element);
    }

    pop() {
        return this._array.pop();
    }

    peek() {
        return this._array[this._array.length - 1];
    }
}
