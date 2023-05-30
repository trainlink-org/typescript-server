import { parser } from './parser';
import { lexer } from './lexer';
import {
    type AutomationScript,
    Scope,
    type EventHandler,
    type HandlerJumpTable,
    isEventHandler,
} from './types';
import { estop } from './commands';

import { turnoutMap } from '../index';
import type { LocoStore } from '../locos';
import { dbConnection } from '../database';
import {
    AutomationType,
    type RunningAutomationClient,
    type PID,
    AutomationStatus,
    Direction,
    type LocoIdentifier,
    EventHandlerType,
} from '@trainlink-org/trainlink-types';

import { EventEmitter } from 'events';
import { format as sqlFormat } from 'mysql';

/**
 * Provides the environment to store and run automations
 */
export class Runtime {
    private _store: LocoStore;
    private _scriptsStore = new Map<number, AutomationScript>();
    private _runningScriptsStore = new Map<PID, ScriptRunner>();
    private _updateCallback: (
        runningAutomations: RunningAutomationClient[]
    ) => void;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private _persistentUpdateCallback = () => {};
    private _pidAllocator = new pidAllocator();
    private _persistentStore: ScriptStoreProvider = new ScriptStoreDB();
    private _eventHandlers: HandlerJumpTable = {
        turnouts: { throw: new Map(), close: new Map() },
    };

    /**
     * Creates a new runtime
     * @param store Store containing the locos the runtime can use
     * @param callback A callback called when a running automation changes
     */
    constructor(
        store: LocoStore,
        callback: (runningAutomations: RunningAutomationClient[]) => void
    ) {
        this._store = store;
        this._updateCallback = callback;
        // this.loadPersistentScripts();
    }

    /**
     * Adds a callback to be run when the persistent store is changed
     * @param callback The callback to be set
     */
    registerPersistentUpdateCallback(callback: () => void) {
        this._persistentUpdateCallback = callback;
    }

    /**
     * Loads automations from the persistent store
     */
    public async loadPersistentScripts() {
        const scripts = await this._persistentStore.loadScripts();
        scripts.forEach((script) => {
            if (script.eventHandlerType !== EventHandlerType.none) {
                this._registerEventHandler(script);
            }
            this._scriptsStore.set(script.id, script);
        });
    }

    /**
     * Compiles a script and adds it to the store
     * @param scriptContent The script to be added
     */
    async addScriptFile(scriptContent: string): Promise<void> {
        await lexer(scriptContent)
            .then((output) => parser(output))
            .then((output) => {
                output.forEach((script) => {
                    if (script.eventHandlerType !== EventHandlerType.none) {
                        this._registerEventHandler(script);
                    }
                    this._scriptsStore.set(script.id, script);
                    this._persistentStore.saveScript(script);
                });
            });
    }

    /**
     * Runs an available script
     * @param scriptId The id of the script to run
     * @param locoID The id of the loco to allocate to the script (not needed for routes)
     */
    async runScript(scriptId: number, locoID?: LocoIdentifier) {
        console.log(`Running script ${scriptId}...`);
        const script = this._scriptsStore.get(scriptId);
        if (script) {
            let scope: Scope;
            if (script.type === AutomationType.automation && locoID) {
                const loco = await this._store.getLoco(locoID);
                scope = new Scope(turnoutMap, loco);
            } else {
                scope = new Scope(turnoutMap);
            }
            const pid = this._pidAllocator.newPID(script.id);
            this._runningScriptsStore.set(
                pid,
                new ScriptRunner(pid, script, scope, () => {
                    console.log('Finished!');
                    this._runningScriptsStore.delete(pid);
                    this._updateCallback(this.getRunningAutomations());
                    this._pidAllocator.freePID(pid);
                })
            );
            this._runningScriptsStore.get(pid)?.run();
            this._updateCallback(this.getRunningAutomations());
        }
    }

    /**
     * Checks if a script is an event handler and registers it if it is
     * @param script The script to register
     */
    private _registerEventHandler(script: AutomationScript) {
        if (isEventHandler(script)) {
            script.registerEventHandler(this._eventHandlers);
        }
    }

    /**
     * Get all the available automations
     * @returns An array of {@link AutomationScript}
     */
    getAllAutomations(): AutomationScript[] {
        return Array.from(this._scriptsStore.values());
    }

    /**
     * Get all the running automations
     * @returns An array of {@link RunningAutomationClient}
     */
    getRunningAutomations(): RunningAutomationClient[] {
        return Array.from(this._runningScriptsStore.values()).map((value) => {
            if (value.loco) {
                return {
                    name: value.script.name,
                    pid: value.pid,
                    type: value.script.type,
                    status: value.status,
                    description: value.script.description,
                    locoAddress: value.loco.address,
                };
            } else {
                return {
                    name: value.script.name,
                    pid: value.pid,
                    type: value.script.type,
                    status: value.status,
                    description: value.script.description,
                };
            }
        });
    }

    /**
     * Pauses a running automation based of PID
     * @param pid The PID to pause
     */
    pauseAutomation(pid: PID) {
        const automation = this._runningScriptsStore.get(pid);
        if (automation) {
            automation.pause();
            this._updateCallback(this.getRunningAutomations());
        }
    }

    /**
     * Resumes a running automation based of PID
     * @param pid The PID to resume
     */
    resumeAutomation(pid: PID) {
        const automation = this._runningScriptsStore.get(pid);
        if (automation) {
            automation.resume();
            this._updateCallback(this.getRunningAutomations());
        }
    }

    /**
     * Stops a running automation based of PID
     * @param pid The PID to stop
     */
    stopAutomation(pid: PID) {
        const automation = this._runningScriptsStore.get(pid);
        if (automation) {
            automation.stop();
            this._updateCallback(this.getRunningAutomations());
            if (automation.loco) {
                this._store
                    .getLoco(automation.loco.address)
                    .then((loco) => {
                        loco.direction = Direction.stopped;
                        loco.speed = 0;
                    })
                    .catch();
            }
        }
    }

    /**
     * Deletes an automation based of ID
     * @param scriptID The ID of the automation to delete
     */
    deleteAutomation(scriptID: number) {
        this._scriptsStore.delete(scriptID);
        this._persistentStore.deleteScript(scriptID);
        this._persistentUpdateCallback();
    }

    /**
     * Sets a new description for an automation
     * @param scriptID The ID of the automation to edit
     * @param description The new description
     */
    setDescription(scriptID: number, description: string) {
        const script = this._scriptsStore.get(scriptID);
        if (script) {
            script.description = description;
            this._persistentStore.saveScript(script);
            this._persistentUpdateCallback();
        }
    }

    /**
     * Triggers the event handlers for a specific event
     * @param event The event to trigger
     */
    triggerEvent(event: string) {
        const eventArray = event.toLowerCase().split('/');
        let script: EventHandler | undefined = undefined;

        // Handles turnout events
        const turnoutEvent = () => {
            console.log('Turnout event');
            if (eventArray[1] === 'throw') {
                const handlerScript = this._eventHandlers.turnouts.throw.get(
                    Number(eventArray[2])
                );
                if (handlerScript) script = handlerScript;
            } else if (eventArray[1] === 'close') {
                const handlerScript = this._eventHandlers.turnouts.close.get(
                    Number(eventArray[2])
                );
                if (handlerScript) script = handlerScript;
            }
        };

        if (eventArray.length > 1) {
            switch (eventArray[0]) {
                case 'turnout':
                    turnoutEvent();
                    break;
            }
            // Runs the event handler script if one is found
            if (script) {
                // Create the scope
                const scope = new Scope(turnoutMap);
                const pid = this._pidAllocator.newPID(-1);
                // Create the ScriptRunner
                this._runningScriptsStore.set(
                    pid,
                    new ScriptRunner(pid, script, scope, () => {
                        console.log('Finished!');
                        this._runningScriptsStore.delete(pid);
                        this._updateCallback(this.getRunningAutomations());
                        this._pidAllocator.freePID(pid);
                    })
                );
                // Run the script
                this._runningScriptsStore.get(pid)?.run();
                this._updateCallback(this.getRunningAutomations());
            }
        }
    }
}

/**
 * Manages and allocates PIDs
 */
class pidAllocator {
    private _nextPID: Map<number, number>;
    private _freedPIDs: Map<number, number[]>;

    constructor() {
        this._nextPID = new Map();
        this._freedPIDs = new Map();
    }

    /**
     * Marks a process ID as available
     * @param pid The PID to free
     */
    freePID(pid: PID) {
        const id = Number(pid.split('#')[0]);
        const pidArray = this._freedPIDs.get(id);
        if (pidArray) {
            pidArray.push(Number(pid.split('#')[1]));
        } else {
            this._freedPIDs.set(id, [Number(pid.split('#')[1])]);
        }
    }

    /**
     * Gets the next available PID for an automation and marks it as taken
     * @param id The automation to make a PID for
     * @returns A new PID
     */
    newPID(id: number): PID {
        let newPID: number;
        const currentFreedPIDs = this._freedPIDs.get(id);
        if (currentFreedPIDs && currentFreedPIDs.length !== 0) {
            const newPIDUndef = currentFreedPIDs.shift();
            if (newPIDUndef) {
                newPID = newPIDUndef;
            } else {
                newPID = 0;
            }
            this._freedPIDs.set(id, currentFreedPIDs);
        } else {
            const nextAvalPID = this._nextPID.get(id);
            if (nextAvalPID === undefined) {
                newPID = 0;
            } else {
                newPID = nextAvalPID;
            }
            this._nextPID.set(id, newPID + 1);
        }
        return `${id}#${newPID}`;
    }
}

/**
 * Responsible for running a script
 */
export class ScriptRunner {
    readonly script: AutomationScript;
    private _scope: Scope;
    readonly pid: PID;
    private _callback: () => void;
    private _bus = new EventEmitter();
    private _pauseTime = new Date();

    constructor(
        pid: PID,
        script: AutomationScript,
        scope: Scope,
        callback: () => void
    ) {
        this.pid = pid;
        this.script = script;
        this._scope = scope;
        this._callback = callback;
    }

    /**
     * Start running the automation script
     */
    async run() {
        this._scope.running = true;
        this._scope.bus = this._bus;
        console.log('ScriptRunner running...');
        await this.script.execute(this._scope);
        console.log('ScriptRunner finished');
        this._callback();
    }

    /**
     * Stop the automation script early
     */
    stop() {
        this._scope.stopped = true;
        this._callback();
    }

    /**
     * Pause the automation script
     */
    pause() {
        this._pauseTime = new Date();
        console.log(this._scope.currentCommand);
        // const currentCommand = this.scope.currentCommand.map((a => {return a;}));
        this._scope.running = false;
        const scopeCopy = Object.assign({}, this._scope);
        scopeCopy.running = true;
        new estop().execute(scopeCopy);
        // this.scope.currentCommand = currentCommand;
        console.log(this._scope.currentCommand);
    }

    /**
     * Resume the automation if it's paused
     */
    async resume() {
        console.log(this._scope.currentCommand);
        this._scope.running = true;
        if (this._scope.currentCommand.length > 0) {
            if (
                this._scope.currentCommand.length === 2 &&
                this._scope.currentCommand[1].split('(')[0] === 'DELAY'
            ) {
                console.log(this._scope.commandStartTime);
                const startSecond = Math.round(
                    this._scope.commandStartTime[
                        this._scope.commandStartTime.length - 2
                    ].getTime()
                );
                const pauseSecond = Math.round(this._pauseTime.getTime());
                const totalSecond = Number(
                    this._scope.currentCommand[1].split('(')[1].split(')')[0]
                );
                console.log(
                    this._scope.commandStartTime[
                        this._scope.commandStartTime.length - 2
                    ]
                );
                console.log(this._pauseTime);
                console.log(totalSecond);
                console.log(pauseSecond - startSecond);

                const newTime = totalSecond - (pauseSecond - startSecond);
                console.log(`Resuming with ${newTime} seconds to go`);
                this._scope.currentCommand[1] = `DELAY(${newTime})`;
            }
            console.log('Parsing');
            console.log(this._scope.currentCommand);
            let script = 'AUTOMATION(0)';
            for (const command of this._scope.currentCommand) {
                script += ` ${command}`;
            }
            script += ' DONE';
            console.log(script);
            await lexer(script)
                .then((output) => parser(output))
                .then((commands) => {
                    console.log('Command:');
                    console.log(commands);
                    return commands[0].execute(this._scope);
                })
                .then(() => {
                    this._scope.bus?.emit('running');
                });
        } else {
            this._scope.bus?.emit('running');
        }
    }

    /**
     * Find out if an automation is paused
     */
    get status() {
        return this._scope.running
            ? AutomationStatus.running
            : AutomationStatus.paused;
    }

    /**
     * Get the loco used by the automation
     */
    get loco() {
        return this._scope.loco;
    }
}

/**
 * Defines a persistent storage provider for a runtime
 */
interface ScriptStoreProvider {
    saveScript(script: AutomationScript): void;
    deleteScript(script: number): void;
    loadScripts(): Promise<AutomationScript[]>;
}

/**
 * Implementation of {@link ScriptStoreProvider} for a MySQL database
 */
class ScriptStoreDB implements ScriptStoreProvider {
    /**
     * Saves a script to the database
     * @param script The script to save
     */
    saveScript(script: AutomationScript): void {
        // Find out if the script has been saved before
        const sql = 'SELECT script FROM scripts WHERE scriptNum = ?;';
        const inserts = [script.id];
        dbConnection.query(sqlFormat(sql, inserts), (error, results) => {
            if (error) throw error;
            if (results.length === 0) {
                // Script hasn't been saved so need to insert it
                const sql =
                    'INSERT INTO scripts (scriptNum, scriptName, script) VALUES (?,?,?);';
                const inserts = [
                    script.id,
                    script.name,
                    JSON.stringify(script),
                ];
                dbConnection.query(sqlFormat(sql, inserts), (error) => {
                    if (error) throw error;
                });
            } else {
                // Script has been saved so need to update it
                const sql =
                    'UPDATE scripts SET scriptName = ?, script = ? WHERE scriptNum = ?';
                const inserts = [
                    script.name,
                    JSON.stringify(script),
                    script.id,
                ];
                dbConnection.query(sqlFormat(sql, inserts), (error) => {
                    if (error) throw error;
                });
            }
        });
    }

    /**
     * Delete a script from the database
     * @param scriptID Script ID to delete
     */
    deleteScript(scriptID: number): void {
        const sql = 'DELETE FROM scripts WHERE scriptNum = ?';
        const inserts = [scriptID];
        dbConnection.query(sqlFormat(sql, inserts));
    }

    /**
     * Loads all of the scripts that have been saved to the db
     * @returns A promise that resolves with the automation scripts once loaded
     */
    async loadScripts(): Promise<AutomationScript[]> {
        const fetch = new Promise<[string, string][]>((resolve, reject) => {
            const returnArray: [string, string][] = [];
            type Result = {
                script: string;
            };
            // Fetch all the scripts
            dbConnection.query(
                'SELECT script FROM scripts',
                (error, results: Result[]) => {
                    if (error) {
                        reject(error);
                        throw error;
                    }
                    for (const result of results) {
                        returnArray.push([
                            JSON.parse(result.script).source,
                            JSON.parse(result.script).description,
                        ]);
                    }
                    resolve(returnArray);
                }
            );
        });

        const finalReturn = fetch.then(async (scripts) => {
            // Convert the script to an executable object
            const returnArray: AutomationScript[] = [];
            for (const script of scripts) {
                await lexer(script[0])
                    .then((output) => parser(output))
                    .then((parsedScripts) => {
                        parsedScripts[0].description = script[1];
                        returnArray.push(parsedScripts[0]);
                    });
            }
            return returnArray;
        });
        return finalReturn;
    }
}
