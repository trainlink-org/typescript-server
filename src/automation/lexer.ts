import { IntermediateSymbol } from './types';
import {
    AutomationError,
    AutomationErrorType,
} from '@trainlink-org/trainlink-types';

/**
 * Converts one string into an array of understandable symbols
 * @param input the input script as a string
 * @returns An array of symbols to be parsed
 */
export function lexer(input: string): Promise<IntermediateSymbol[]> {
    return new Promise<IntermediateSymbol[]>((resolve, reject) => {
        let splitInput: string[];

        // Stage 1: Comment removal -----------------------------------------------
        if (input.match(/(\/\*)+|(\*\/)+|(\/){2}/g)) {
            // Checks for comments in script
            // If we have newlines in the script
            if (input.includes('\n')) {
                splitInput = input.split('\n'); // Split on newlines

                // Remove any lines starting with '//'
                splitInput = splitInput.filter((value) => {
                    if (value.trim().substring(0, 2) === '//') {
                        return false;
                    } else {
                        return true;
                    }
                });

                // Remove anything after '//' in a line
                splitInput.forEach((value, index) => {
                    if (value.includes('//') && !value.includes('\\//')) {
                        splitInput[index] = value.split('//')[0];
                    }
                });

                // Check if there are any multiline comments
                if (input.includes('/*') && input.includes('*/')) {
                    // Find where all the comment blocks start
                    let startIndex: number[] = [];
                    splitInput.forEach((value, index) => {
                        if (value.includes('/*')) {
                            startIndex.push(index);
                        }
                    });

                    // Iterate over the startIndex array
                    // Can't use a for loop as the indexes are constantly recalculated each iteration
                    while (startIndex.length) {
                        const value = startIndex.shift();
                        if (value !== undefined) {
                            // Keep moving through the inputted text till '*/' is found
                            let endIndex = value;
                            while (!splitInput[endIndex].includes('*/')) {
                                endIndex = endIndex + 1;
                            }

                            // If the line starts with '/*', remove the line
                            if (
                                splitInput[value].trim().substring(0, 2) ===
                                '/*'
                            )
                                splitInput[value] = ' ';
                            // A section consisting of just a space will be removed later
                            // Otherwise remove the section of the line after '/*'
                            else
                                splitInput[value] =
                                    splitInput[value].split('/*')[0];

                            // Remove all the sections between the comment start and end
                            if (endIndex !== value)
                                splitInput.splice(value + 1, endIndex - value);

                            // We just removed some sections so we need to recalculate all the indexes
                            startIndex = startIndex.map((startValue) => {
                                return startValue - (endIndex - value);
                            });
                        }
                    }
                } else if (input.includes('/*') && !input.includes('*/')) {
                    // We are missing the end of a comment block
                    reject(
                        new AutomationError(
                            AutomationErrorType.syntaxError,
                            'Missing end of comment block'
                        )
                    );
                } else if (!input.includes('/*') && input.includes('*/')) {
                    // We are missing the start of a comment block
                    reject(
                        new AutomationError(
                            AutomationErrorType.syntaxError,
                            'Missing start of comment block'
                        )
                    );
                }
                // Rejoin the array with newlines to allow the second stage to work properly
                input = splitInput.join('\n');
            }
        }

        // Stage 2: Remove all forms of whitespace --------------------------------
        if (input.includes('\n')) {
            // Split on newlines and rejoin with spaces
            splitInput = input.split('\n');
            const secondaryInput = splitInput.join(' ');
            // Check for tabs and replace them if they are present
            if (secondaryInput.includes('\t')) {
                splitInput = secondaryInput.split('\t');
            } else {
                splitInput = secondaryInput.split(' ');
            }
        } else if (input.includes('\t')) {
            // Split on tabs to remove them
            splitInput = input.split('\t');
        } else {
            // Split on blank spaces
            splitInput = input.split(' ');
        }
        // Remove all empty sections
        splitInput = splitInput.filter((value) => value !== '');

        // Stage 3: Regroup brackets and strings ----------------------------------
        splitInput.forEach((value, index) => {
            // Iterate over each element
            // Keep going if element doesn't include ) but includes (
            while (value.includes('(') && !value.includes(')')) {
                // Join the elements with a space if inside a string
                if ((value.match(/["']+/g) || []).length % 2 === 1) {
                    value = value + ' ' + splitInput[index + 1];
                } else {
                    value = value + splitInput[index + 1];
                }
                // Reinsert the joined string and remove the empty elements from the array
                splitInput[index] = value;
                splitInput.splice(index + 1, 1);
            }
        });

        // Stage 4: Convert to symbols --------------------------------------------
        const symbolList: IntermediateSymbol[] = splitInput.map(
            (value): IntermediateSymbol => {
                // If the command has parameters
                if (value.includes('(')) {
                    const line = value.split('(');
                    const opcode = line[0];
                    let operands = line[1];
                    // Split the array to get the individual parameters
                    operands = operands.replace(')', '');
                    const operandsArray = operands.split(',').map((value) => {
                        if (value.match(/["']+/g)) {
                            return value.replace(/["']+/g, '');
                        } else {
                            return value;
                        }
                    });

                    return {
                        name: opcode.toUpperCase(),
                        args: operandsArray,
                    };
                    // No parameters for this command
                } else {
                    return {
                        name: value.toUpperCase(),
                        args: [],
                    };
                }
            }
        );
        resolve(symbolList);
    });
}
