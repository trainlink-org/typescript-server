import { TurnoutGraph } from './graph';
import {
    findPath,
    findPathNew,
    getNeighbours,
    pathToTurnouts,
} from './routeFinder';

import {
    type Destination,
    type Turnout,
    type TurnoutLink,
    type RouteObject,
    type Coordinate,
    type Node,
    TurnoutState,
    type HardwareAdapter,
} from '@trainlink-org/trainlink-types';
import { io } from '../socket';

import type { Socket } from 'socket.io';
import type { Runtime } from '../automation/runtime';
import type { Database } from 'sqlite';
import { log } from '../logger';

type turnoutId = number;

/**
 * Stores the map of turnouts and destinations
 */
export class TurnoutMap {
    private _turnoutGraph: TurnoutGraph = new TurnoutGraph();
    private _usedLinks: Map<number, number> = new Map();
    private _usedDestinations: Map<number, number> = new Map();
    private _usedTurnouts: Map<number, number> = new Map();
    private _activeRoutes: Map<number, RouteObject> = new Map();
    private _routeIdAllocator: routeIdAllocator = new routeIdAllocator();
    private _dbConnection: Database;
    private _adapter: HardwareAdapter;
    private _runtime: Runtime | undefined;

    constructor(dbConnection: Database, adapter: HardwareAdapter) {
        this._dbConnection = dbConnection;
        this._adapter = adapter;
    }

    attachRuntime(runtime: Runtime) {
        this._runtime = runtime;
    }

    /**
     * Set a turnout's state
     * @param id The ID of the turnout to set
     * @param state The TurnoutState to set the turnout to
     */
    async setTurnout(id: turnoutId, state: TurnoutState) {
        const turnout = await this.getTurnout(id);
        if (turnout) {
            // Check if the change will invalidate a currently set route
            const routeID = this._usedTurnouts.get(id);
            if (routeID !== undefined) {
                const route = this._activeRoutes.get(routeID);
                if (route) this._clearRoute(route);
            }
            // Set the state, update all clients and send it to the hardware adapter
            turnout.state = state;
            this._runtime?.triggerEvent(
                `turnout/${
                    state === TurnoutState.closed ? 'close' : 'throw'
                }/${id}`,
            );
            io.emit('routes/turnoutUpdate', turnout.id, turnout.state);
            //TODO implement error handling
            void this._adapter.turnoutSet(turnout.id, turnout.state);
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const turnoutState = turnout.state === TurnoutState.thrown;
            const query = 'UPDATE turnouts SET state = ? WHERE idturnouts = ?';
            const inserts = [turnoutState, id];
            await this._dbConnection.run(query, inserts);
        }
    }

    /**
     * Set a route between two destinations
     * @param startID ID of the destination to start at
     * @param endID ID of the destination to end at
     */
    async setRoute(startID: number, endID: number) {
        // const start = await this.getDestination(startID);
        // const end = await this.getDestination(endID);
        const start = await this.getNode(startID);
        const end = await this.getNode(endID);
        if (start && end) {
            // await findPath(start, end, this._turnoutGraph);
            await findPathNew(start, end, this._dbConnection, this)
                .then(
                    (path): Promise<RouteObject> =>
                        pathToTurnouts(path, this, this._turnoutGraph),
                )
                .then((path) => {
                    this._clearRoute(path);
                    path.turnouts.forEach(async (newTurnoutState) => {
                        const turnout = await this.getTurnout(
                            newTurnoutState.id,
                        );
                        if (
                            turnout &&
                            turnout.state !== newTurnoutState.state
                        ) {
                            turnout.state = newTurnoutState.state;
                            this._runtime?.triggerEvent(
                                `turnout/${
                                    turnout.state === TurnoutState.closed
                                        ? 'close'
                                        : 'throw'
                                }/${turnout.id}`,
                            );
                            this._adapter.turnoutSet(turnout.id, turnout.state);
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            const turnoutState =
                                turnout.state === TurnoutState.thrown;
                            const query =
                                'UPDATE turnouts SET state = ? WHERE idturnouts = ?';
                            const inserts = [turnoutState, turnout.id];
                            await this._dbConnection.run(query, inserts);
                        }
                    });
                    const routeID = this._routeIdAllocator.newRouteID();
                    this._activeRoutes.set(routeID, path);
                    const destinations: number[] = [];
                    const turnouts: number[] = [];
                    const links: number[] = [];
                    path.turnouts.forEach(async (turnout) => {
                        turnouts.push(turnout.id);
                        const turnoutObject = await this.getTurnout(turnout.id);
                        if (turnoutObject)
                            this._usedTurnouts.set(turnoutObject.id, routeID);
                    });
                    path.links.forEach((link) => {
                        links.push(link.id);
                        this._usedLinks.set(link.id, routeID);
                    });
                    this._usedDestinations.set(path.start.id, routeID);
                    destinations.push(path.start.id);
                    this._usedDestinations.set(path.end.id, routeID);
                    destinations.push(path.end.id);
                    io.emit(
                        'routes/setRouteComponents',
                        destinations,
                        turnouts,
                        links,
                    );
                    io.emit('routes/routeUpdate', path);
                })
                .catch((reason) => log(`Unable to create route: ${reason}`));
        }
    }

    /**
     * Clears a route from the list of set routes
     * @param route The route to clear
     */
    private _clearRoute(route: RouteObject) {
        const routesToClear: number[] = [];
        route.turnouts.forEach((turnout) => {
            const routeID = this._usedTurnouts.get(turnout.id);
            if (routeID !== undefined) {
                routesToClear.push(routeID);
            }
        });
        route.links.forEach((link) => {
            const routeID = this._usedLinks.get(link.id);
            if (routeID !== undefined) {
                routesToClear.push(routeID);
            }
        });
        [route.start, route.end].forEach((destination) => {
            const routeID = this._usedDestinations.get(destination.id);
            if (routeID !== undefined) {
                routesToClear.push(routeID);
            }
        });
        const destinations: number[] = [];
        const turnouts: number[] = [];
        const links: number[] = [];
        routesToClear.forEach((routeID) => {
            const route = this._activeRoutes.get(routeID);
            if (route) {
                route.turnouts.forEach((turnout) => {
                    turnouts.push(turnout.id);
                    this._usedTurnouts.delete(turnout.id);
                });
                route.links.forEach((link) => {
                    links.push(link.id);
                    this._usedLinks.delete(link.id);
                });
                this._usedDestinations.delete(route.start.id);
                destinations.push(route.start.id);
                this._usedDestinations.delete(route.end.id);
                destinations.push(route.end.id);
                this._activeRoutes.delete(routeID);
                this._routeIdAllocator.freeRouteID(routeID);
            }
        });
        io.emit('routes/unsetRouteComponents', destinations, turnouts, links);
    }

    /**
     * Sends the current state of the turnouts to a newly connected client
     * @param socket Socket instance to send the state to
     */
    sendInitialState(socket: Socket) {
        const destinations: number[] = [];
        const turnouts: number[] = [];
        const links: number[] = [];
        this._activeRoutes.forEach((route) => {
            route.turnouts.forEach((turnout) => {
                turnouts.push(turnout.id);
            });
            route.links.forEach((link) => {
                links.push(link.id);
            });
            destinations.push(route.start.id);
            destinations.push(route.end.id);
        });
        socket.emit('routes/setRouteComponents', destinations, turnouts, links);
    }

    /**
     * Fetches a known turnout from it's id
     * @param id The ID of the turnout to fetch
     * @returns The turnout if found
     */
    getTurnout(id: number): Promise<Turnout> {
        const sql =
            'SELECT n.nodeID id, n.name, n.description, n.coordinate, npd.linkID primaryDirection, nsd.linkID secondaryDirection, n.state  FROM ((Nodes n INNER JOIN Node_PrimaryDirection npd ON n.nodeID = npd.nodeID  ) INNER JOIN Node_SecondaryDirection nsd  ON n.nodeID = nsd.nodeID) WHERE n.nodeID = ? AND n.nodeType = "turnout"';
        const inserts = [id];
        type Results = {
            id: number;
            name: string;
            description: string;
            coordinate: string;
            primaryDirection: number;
            secondaryDirection: number;
            state: boolean;
        };
        return this._dbConnection.get(sql, inserts).then((result: Results) => {
            return {
                id: result.id,
                name: result.name,
                coordinate: JSON.parse(result.coordinate),
                state: result.state ? TurnoutState.thrown : TurnoutState.closed,
                primaryDirection: result.primaryDirection,
                secondaryDirection: result.secondaryDirection,
            };
        });
    }

    /**
     * Gets all the turnouts defined in the database
     * @returns All the defined turnouts
     */
    getTurnouts(): Promise<Turnout[]> {
        type Results = {
            id: number;
            name: string;
            description: string;
            coordinate: string;
            primaryDirection: number;
            secondaryDirection: number;
            state: boolean;
        }[];
        return this._dbConnection
            .all(
                'SELECT n.nodeID id, n.name, n.description, n.coordinate, npd.linkID primaryDirection, nsd.linkID secondaryDirection, n.state  FROM ((Nodes n INNER JOIN Node_PrimaryDirection npd ON n.nodeID = npd.nodeID  ) INNER JOIN Node_SecondaryDirection nsd  ON n.nodeID = nsd.nodeID) WHERE n.nodeType = "turnout"',
            )
            .then((results: Results) => {
                return results.map((result) => {
                    return {
                        id: result.id,
                        name: result.name,
                        coordinate: JSON.parse(result.coordinate),
                        state: result.state
                            ? TurnoutState.thrown
                            : TurnoutState.closed,
                        primaryDirection: result.primaryDirection,
                        secondaryDirection: result.secondaryDirection,
                    };
                });
            });
    }

    getLink(id: number): Promise<TurnoutLink> {
        const sql = 'SELECT * FROM Links WHERE linkID = ?';
        const inserts = [id];
        type Result = {
            linkID: number;
            startNodeID: number;
            endNodeID: number;
            linkLength: number;
            points: string;
        };
        return this._dbConnection.get(sql, inserts).then((result: Result) => {
            return {
                id: result.linkID,
                length: result.linkLength,
                start: result.startNodeID,
                end: result.endNodeID,
                points: JSON.parse(result.points),
                startActive: false,
                endActive: false,
            };
        });
    }

    /**
     * Gets all the turnout links defined in the database
     * @returns All the defined turnout links
     */
    getLinks(): Promise<TurnoutLink[]> {
        // return new Promise<TurnoutLink[]>((resolve) => {
        type Results = {
            linkID: number;
            startNodeID: number;
            endNodeID: number;
            linkLength: number;
            points: string;
        }[];
        return this._dbConnection
            .all('SELECT * FROM Links;')
            .then((results: Results) => {
                // const turnoutLinks: TurnoutLink[] = results.map((value) => {
                return results.map((result) => {
                    return {
                        id: result.linkID,
                        length: result.linkLength,
                        start: result.startNodeID,
                        end: result.endNodeID,
                        points: JSON.parse(result.points),
                        startActive: false,
                        endActive: false,
                    };
                });
            });
        // });
    }

    getDestination(id: number): Promise<Destination> {
        const sql =
            'SELECT nodeID id, name, description, coordinate FROM Nodes WHERE nodeType = "destination" AND nodeID = ?';
        const inserts = [id];
        return this._dbConnection.get(sql, inserts).catch((reason) => {
            throw reason;
        });
    }

    /**
     * Gets all the destinations defined in the database
     * @returns All the defined destinations
     */
    getDestinations(): Promise<Destination[]> {
        type Results = {
            nodeID: number;
            name: string;
            description: string;
            nodeType: string;
            coordinate: string;
            state: boolean;
        }[];
        return this._dbConnection
            .all('SELECT * FROM Nodes WHERE nodeType = "destination"')
            .then((results: Results) => {
                return results.map((result) => {
                    return {
                        id: result.nodeID,
                        name: result.name,
                        description: result.description,
                        coordinate: JSON.parse(result.coordinate),
                    };
                });
            });
    }

    getNode(id: number): Promise<Node> {
        const sql = 'SELECT * FROM Nodes WHERE nodeID = ?;';
        const inserts = [id];
        type Result = {
            nodeID: number;
            name: string;
            description: string;
            nodeType: string;
            coordinate: string;
            state: boolean;
        };
        return this._dbConnection.get(sql, inserts).then((result: Result) => {
            return {
                id: result.nodeID,
                name: result.name,
                type: result.nodeType,
                coordinate: JSON.parse(result.coordinate),
                state: result.state,
            };
        });
    }

    getNodes(): Promise<Node[]> {
        type Results = {
            nodeID: number;
            name: string;
            description: string;
            nodeType: string;
            coordinate: string;
            state: boolean;
        }[];
        return this._dbConnection
            .all('SELECT * FROM Nodes')
            .then((results: Results) => {
                return results.map((result) => {
                    return {
                        id: result.nodeID,
                        name: result.name,
                        type: result.nodeType,
                        coordinate: JSON.parse(result.coordinate),
                        state: result.state,
                    };
                });
            });
    }

    /**
     * Loads the turnout map from the database
     */
    async loadTurnoutMap() {
        // const start = await this.getNode(2);
        // const end = await this.getNode(7);
        // findPathNew(start, end, this._dbConnection, this);
        // this._dbConnection.get('SELECT * FROM Test');
        // await findPathNew(
        //     await this.getNode(1),
        //     await this.getNode(2),
        //     this._dbConnection,
        //     this,
        // );
        // console.log(
        //     `Resolved to: ${await findPathNew(
        //         await this.getNode(1),
        //         await this.getNode(2),
        //         this._dbConnection,
        //         this,
        //     )}`,
        // );
        // console.log(await this.getLinks());
        // console.log(
        //     findPath(
        //         {
        //             id: 1,
        //             name: '',
        //             description: '',
        //             coordinate: { x: 0, y: 0 },
        //         },
        //         {
        //             id: 2,
        //             name: '',
        //             description: '',
        //             coordinate: { x: 0, y: 0 },
        //         },
        //         this._turnoutGraph,
        //     ),
        // );
        new Promise<void>((resolve) => {
            this.getTurnouts().then((turnouts) => {
                turnouts.forEach((turnout) => {
                    this._addTurnoutGraph(turnout);
                });
                resolve();
            });
        })
            .then(() => {
                // Get the destinations from the db
                return new Promise<void>((resolve) => {
                    this.getDestinations().then((destinations) => {
                        destinations.forEach((destination) => {
                            this._addDestinationGraph(destination);
                        });
                        resolve();
                    });
                });
            })
            .then(() => {
                // Get the links between turnouts from the db
                return new Promise<void>((resolve) => {
                    type results = {
                        idturnoutLinks: number;
                        length: number;
                        start_dest: number | null;
                        start: number | null;
                        end: number | null;
                        points: string;
                    }[];
                    this._dbConnection
                        .all('SELECT * FROM turnoutLinks')
                        .then((results: results) => {
                            const turnoutLinks: TurnoutLink[] = results.map(
                                (value) => {
                                    return {
                                        id: value.idturnoutLinks,
                                        length: value.length,
                                        start:
                                            value.start_dest ||
                                            value.start ||
                                            0,
                                        end: value.end || 0,
                                        points: JSON.parse(value.points),
                                        startActive: false,
                                        endActive: false,
                                    };
                                },
                            );
                            turnoutLinks.forEach((value) => {
                                this._addTurnoutLinkGraph(value);
                            });
                            resolve();
                        });
                });
            })
            .then(async () => {
                // Set initial active sections for the links
                (await this.getTurnouts()).forEach(async (turnout) => {
                    const link = await this.getLink(turnout.primaryDirection);
                    if (link) {
                        if (link.start === turnout.id) {
                            link.startActive = true;
                        } else {
                            link.endActive = true;
                        }
                    }
                });
            })
            .then(async () => {
                // console.log(
                //     `Resolved to: ${await findPathNew(
                //         await this.getNode(1),
                //         await this.getNode(2),
                //         this._dbConnection,
                //         this,
                //     )}`,
                // );
                // console.log(
                //     await findPath(
                //         {
                //             id: 1,
                //             name: '',
                //             description: '',
                //             coordinate: { x: 0, y: 0 },
                //         },
                //         {
                //             id: 2,
                //             name: '',
                //             description: '',
                //             coordinate: { x: 0, y: 0 },
                //         },
                //         this._turnoutGraph,
                //     ),
                // );
            });
    }

    /**
     * Updates the coordinates of a turnout
     * @param turnoutId The id of the turnout to update
     * @param coord The new coordinate
     * @returns A promise that resolves when complete
     */
    updateTurnoutCoordinate(
        turnoutId: number,
        coord: Coordinate,
    ): Promise<void> {
        return new Promise<void>((resolve) => {
            const sql =
                'UPDATE turnouts SET coordinate = ? WHERE idturnouts = ?';
            const inserts = [JSON.stringify(coord), turnoutId];
            this._dbConnection.run(sql, inserts).then(() => resolve());
        });
    }

    /**
     * Adds a turnout to the graph
     * @param turnout The turnout to add
     */
    private _addTurnoutGraph(turnout: Turnout) {
        this._turnoutGraph.addVertex(turnout);
    }

    /**
     * Adds a link to the graph
     * @param turnoutLink The link to add
     */
    private _addTurnoutLinkGraph(turnoutLink: TurnoutLink) {
        this._turnoutGraph.addEdge(turnoutLink);
    }

    /**
     * Adds a destination to the graph
     * @param destination The destination to add
     */
    private _addDestinationGraph(destination: Destination) {
        this._turnoutGraph.addVertex(destination);
    }
}

type RouteID = number;

/**
 * Manages and allocates RouteIDs
 */
class routeIdAllocator {
    private _nextRouteID = 1;
    private _freedRouteIDs: number[] = [];

    /**
     * Marks a previously allocated routeID as available
     * @param routeID The id to free
     */
    freeRouteID(routeID: RouteID) {
        this._freedRouteIDs.push(routeID);
    }

    /**
     * Gets a new ID for a route that is guaranteed to be unique
     * @returns A new routeID
     */
    newRouteID(): RouteID {
        let newRouteID: number;
        if (this._freedRouteIDs.length !== 0) {
            const newRouteIDUndef = this._freedRouteIDs.shift();
            if (newRouteIDUndef) {
                newRouteID = newRouteIDUndef;
            } else {
                newRouteID = 0;
            }
        } else {
            newRouteID = this._nextRouteID;
            this._nextRouteID++;
        }
        return newRouteID;
    }
}
