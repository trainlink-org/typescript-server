import { TurnoutGraph } from './graph';
import { findPath, pathToTurnouts } from './routeFinder';

import { adapter, runtime } from '../index';
import {
    Destination,
    Turnout,
    TurnoutLink,
    TurnoutState,
    RouteObject,
    Coordinate,
} from '@trainlink-org/trainlink-types';
import { io } from '../socket';
import { dbConnection } from '../database';

import { Socket } from 'socket.io';
import { format as sqlFormat } from 'mysql';

type turnoutId = number;

/**
 * Stores the map of turnouts and destinations
 */
export class TurnoutMap {
    private turnoutGraph: TurnoutGraph = new TurnoutGraph();
    private usedLinks: Map<number, number> = new Map();
    private usedDestinations: Map<number, number> = new Map();
    private usedTurnouts: Map<number, number> = new Map();
    private activeRoutes: Map<number, RouteObject> = new Map();
    private routeIdAllocator: routeIdAllocator = new routeIdAllocator();

    /**
     * Set a turnout's state
     * @param id The ID of the turnout to set
     * @param state The TurnoutState to set the turnout to
     */
    async setTurnout(id: turnoutId, state: TurnoutState) {
        const turnout = await this.getTurnout(id);
        if (turnout) {
            // Check if the change will invalidate a currently set route
            const routeID = this.usedTurnouts.get(id);
            if (routeID !== undefined) {
                const route = this.activeRoutes.get(routeID);
                if (route) this.clearRoute(route);
            }
            // Set the state, update all clients and send it to the hardware adapter
            turnout.state = state;
            runtime.triggerEvent(
                `turnout/${
                    state === TurnoutState.closed ? 'close' : 'throw'
                }/${id}`
            );
            io.emit('routes/turnoutUpdate', turnout.id, turnout.state);
            adapter.turnoutSet(turnout.id, turnout.state);
            const turnoutState = turnout.state === TurnoutState.thrown;
            const query = 'UPDATE turnouts SET state = ? WHERE idturnouts = ?';
            const inserts = [turnoutState, id];
            dbConnection.query(sqlFormat(query, inserts), (error) => {
                if (error) throw error;
            });
        }
    }

    /**
     * Set a route between two destinations
     * @param startID ID of the destination to start at
     * @param endID ID of the destination to end at
     */
    async setRoute(startID: number, endID: number) {
        const start = await this.getDestination(startID);
        const end = await this.getDestination(endID);
        if (start && end) {
            await findPath(start, end, this.turnoutGraph)
                .then((path) =>
                    pathToTurnouts(
                        path,
                        this.getDestination,
                        this.getDestinations,
                        this.getTurnout,
                        this.getTurnouts,
                        this.getLink,
                        this.turnoutGraph
                    )
                )
                .then((path) => {
                    this.clearRoute(path);
                    path.turnouts.forEach(async (newTurnoutState) => {
                        const turnout = await this.getTurnout(
                            newTurnoutState.id
                        );
                        if (
                            turnout &&
                            turnout.state !== newTurnoutState.state
                        ) {
                            turnout.state = newTurnoutState.state;
                            runtime.triggerEvent(
                                `turnout/${
                                    turnout.state === TurnoutState.closed
                                        ? 'close'
                                        : 'throw'
                                }/${turnout.id}`
                            );
                            adapter.turnoutSet(turnout.id, turnout.state);
                            const turnoutState =
                                turnout.state === TurnoutState.thrown;
                            const query =
                                'UPDATE turnouts SET state = ? WHERE idturnouts = ?';
                            const inserts = [turnoutState, turnout.id];
                            dbConnection.query(
                                sqlFormat(query, inserts),
                                (error) => {
                                    if (error) throw error;
                                }
                            );
                        }
                    });
                    const routeID = this.routeIdAllocator.newRouteID();
                    this.activeRoutes.set(routeID, path);
                    const destinations: number[] = [];
                    const turnouts: number[] = [];
                    const links: number[] = [];
                    path.turnouts.forEach(async (turnout) => {
                        turnouts.push(turnout.id);
                        const turnoutObject = await this.getTurnout(turnout.id);
                        if (turnoutObject)
                            this.usedTurnouts.set(turnoutObject.id, routeID);
                    });
                    path.links.forEach((link) => {
                        links.push(link.id);
                        this.usedLinks.set(link.id, routeID);
                    });
                    this.usedDestinations.set(path.start.id, routeID);
                    destinations.push(path.start.id);
                    this.usedDestinations.set(path.end.id, routeID);
                    destinations.push(path.end.id);
                    io.emit(
                        'routes/setRouteComponents',
                        destinations,
                        turnouts,
                        links
                    );
                    io.emit('routes/routeUpdate', path);
                })
                .catch((reason) =>
                    console.log(`Unable to create route: ${reason}`)
                );
        }
    }

    /**
     * Clears a route from the list of set routes
     * @param route The route to clear
     */
    private clearRoute(route: RouteObject) {
        const routesToClear: number[] = [];
        route.turnouts.forEach((turnout) => {
            const routeID = this.usedTurnouts.get(turnout.id);
            if (routeID !== undefined) {
                routesToClear.push(routeID);
            }
        });
        route.links.forEach((link) => {
            const routeID = this.usedLinks.get(link.id);
            if (routeID !== undefined) {
                routesToClear.push(routeID);
            }
        });
        [route.start, route.end].forEach((destination) => {
            const routeID = this.usedDestinations.get(destination.id);
            if (routeID !== undefined) {
                routesToClear.push(routeID);
            }
        });
        const destinations: number[] = [];
        const turnouts: number[] = [];
        const links: number[] = [];
        routesToClear.forEach((routeID) => {
            const route = this.activeRoutes.get(routeID);
            if (route) {
                route.turnouts.forEach((turnout) => {
                    turnouts.push(turnout.id);
                    this.usedTurnouts.delete(turnout.id);
                });
                route.links.forEach((link) => {
                    links.push(link.id);
                    this.usedLinks.delete(link.id);
                });
                this.usedDestinations.delete(route.start.id);
                destinations.push(route.start.id);
                this.usedDestinations.delete(route.end.id);
                destinations.push(route.end.id);
                this.activeRoutes.delete(routeID);
                this.routeIdAllocator.freeRouteID(routeID);
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
        this.activeRoutes.forEach((route) => {
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
     * Gets all the turnouts defined in the database
     * @returns All the defined turnouts
     */
    getTurnouts(): Promise<Turnout[]> {
        return new Promise<Turnout[]>((resolve) => {
            type Results = {
                idturnouts: number;
                name: string | null;
                description: string | null;
                primary_direction: number | null;
                secondary_direction: number | null;
                state: boolean;
                coordinate: string;
            }[];
            dbConnection.query(
                'SELECT * FROM turnouts;',
                (error, results: Results) => {
                    if (error) throw error;
                    const turnouts: Turnout[] = results.map((value) => {
                        return {
                            id: value.idturnouts,
                            name: value.name || '',
                            primaryDirection: value.primary_direction || 0,
                            secondaryDirection: value.secondary_direction || 0,
                            state: value.state
                                ? TurnoutState.thrown
                                : TurnoutState.closed,
                            coordinate: JSON.parse(value.coordinate),
                            connections: [],
                        };
                    });
                    resolve(turnouts);
                }
            );
        }).then((turnouts) => {
            turnouts.forEach((turnout) => {
                const sql =
                    'SELECT idturnoutLinks FROM turnoutLinks WHERE start = ? OR end = ?';
                const inserts = [turnout.id, turnout.id];
                type Results = {
                    idturnoutLinks: number;
                }[];
                dbConnection.query(
                    sqlFormat(sql, inserts),
                    (error, results: Results) => {
                        if (error) throw error;
                        results.forEach((result) => {
                            turnout.connections.push(result.idturnoutLinks);
                        });
                    }
                );
            });
            return turnouts;
        });
    }

    /**
     * Gets all the turnout links defined in the database
     * @returns All the defined turnout links
     */
    async getLinks(): Promise<TurnoutLink[]> {
        return new Promise<TurnoutLink[]>((resolve) => {
            type Results = {
                idturnoutLinks: number;
                length: number;
                start_dest: number | null;
                start: number | null;
                end: number | null;
                points: string;
            }[];
            dbConnection.query(
                'SELECT * FROM turnoutLinks;',
                (error, results: Results) => {
                    if (error) throw error;
                    const turnoutLinks: TurnoutLink[] = results.map((value) => {
                        return {
                            id: value.idturnoutLinks,
                            length: value.length,
                            start: value.start_dest || value.start || 0,
                            end: value.end || 0,
                            points: JSON.parse(value.points),
                            startActive: false,
                            endActive: false,
                        };
                    });
                    resolve(turnoutLinks);
                }
            );
        });
    }

    getLink(id: number): Promise<TurnoutLink> {
        return new Promise<TurnoutLink>((resolve) => {
            type Results = {
                idturnoutLinks: number;
                length: number;
                start_dest: number | null;
                start: number | null;
                end: number | null;
                points: string;
            }[];
            const sql = 'SELECT * FROM turnoutLinks WHERE idturnoutlinks = ?;';
            const inserts = [id];
            dbConnection.query(
                sqlFormat(sql, inserts),
                (error, results: Results) => {
                    if (error) throw error;
                    const turnoutLinks: TurnoutLink[] = results.map((value) => {
                        return {
                            id: value.idturnoutLinks,
                            length: value.length,
                            start: value.start_dest || value.start || 0,
                            end: value.end || 0,
                            points: JSON.parse(value.points),
                            startActive: false,
                            endActive: false,
                        };
                    });
                    resolve(turnoutLinks[0]);
                }
            );
        });
    }

    /**
     * Gets all the destinations defined in the database
     * @returns All the defined destinations
     */
    getDestinations(): Promise<Destination[]> {
        return new Promise<Destination[]>((resolve) => {
            type Results = {
                iddestinations: number;
                name: string | null;
                description: string | null;
                coordinate: string;
            }[];
            dbConnection.query(
                'SELECT * FROM destinations;',
                (error, results: Results) => {
                    if (error) throw error;
                    const destinations: Destination[] = results.map((value) => {
                        return {
                            id: value.iddestinations,
                            name: value.name || '',
                            description: value.description || '',
                            state: TurnoutState.closed,
                            coordinate: JSON.parse(value.coordinate),
                            connections: [],
                        };
                    });
                    resolve(destinations);
                }
            );
        }).then((destinations) => {
            destinations.forEach((destination) => {
                const sql =
                    'SELECT idturnoutLinks FROM turnoutLinks WHERE start_dest = ?';
                const inserts = [destination.id];
                type Results = {
                    idturnoutLinks: number;
                }[];
                dbConnection.query(
                    sqlFormat(sql, inserts),
                    (error, results: Results) => {
                        if (error) throw error;
                        results.forEach((result) => {
                            destination.connections.push(result.idturnoutLinks);
                        });
                    }
                );
            });
            return destinations;
        });
    }

    async getDestination(id: number): Promise<Destination> {
        return new Promise<Destination>((resolve) => {
            type Results = {
                iddestinations: number;
                name: string | null;
                description: string | null;
                coordinate: string;
            }[];
            const sql = 'SELECT * FROM destinations WHERE iddestinations = ?';
            const inserts = [id];
            dbConnection.query(
                sqlFormat(sql, inserts),
                (error, results: Results) => {
                    if (error) throw error;
                    // console.log(results);
                    const destinations: Destination[] = results.map((value) => {
                        return {
                            id: value.iddestinations,
                            name: value.name || '',
                            description: value.description || '',
                            state: TurnoutState.closed,
                            coordinate: JSON.parse(value.coordinate),
                            connections: [],
                        };
                    });
                    resolve(destinations[0]);
                }
            );
        }).then((destination) => {
            if (destination) {
                const sql =
                    'SELECT idturnoutLinks FROM turnoutLinks WHERE start_dest = ?';
                const inserts = [destination.id];
                type Results = {
                    idturnoutLinks: number;
                }[];
                dbConnection.query(
                    sqlFormat(sql, inserts),
                    (error, results: Results) => {
                        if (error) throw error;
                        results.forEach((result) => {
                            destination.connections.push(result.idturnoutLinks);
                        });
                    }
                );
            }
            return destination;
        });
    }

    /**
     * Loads the turnout map from the database
     */
    loadTurnoutMap() {
        new Promise<void>((resolve) => {
            this.getTurnouts().then((turnouts) => {
                turnouts.forEach((turnout) => {
                    this.addTurnoutGraph(turnout);
                });
                resolve();
            });
        })
            .then(() => {
                // Get the destinations from the db
                return new Promise<void>((resolve) => {
                    this.getDestinations().then((destinations) => {
                        destinations.forEach((destination) => {
                            this.addDestinationGraph(destination);
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
                    dbConnection.query(
                        'SELECT * FROM turnoutLinks',
                        (error, results: results) => {
                            if (error) throw error;
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
                                }
                            );
                            turnoutLinks.forEach((value) => {
                                this.addTurnoutLinkGraph(value);
                            });
                            resolve();
                        }
                    );
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
        coord: Coordinate
    ): Promise<void> {
        return new Promise<void>((resolve) => {
            const sql =
                'UPDATE turnouts SET coordinate = ? WHERE idturnouts = ?';
            const inserts = [JSON.stringify(coord), turnoutId];
            dbConnection.query(sqlFormat(sql, inserts), (error) => {
                if (error) throw error;
                resolve();
            });
        });
    }

    /**
     * Adds a turnout to the graph
     * @param turnout The turnout to add
     */
    private addTurnoutGraph(turnout: Turnout) {
        this.turnoutGraph.addVertex(turnout);
    }

    /**
     * Adds a link to the graph
     * @param turnoutLink The link to add
     */
    private addTurnoutLinkGraph(turnoutLink: TurnoutLink) {
        this.turnoutGraph.addEdge(turnoutLink);
    }

    /**
     * Adds a destination to the graph
     * @param destination The destination to add
     */
    private addDestinationGraph(destination: Destination) {
        this.turnoutGraph.addVertex(destination);
    }

    /**
     * Fetches a known turnout from it's id
     * @param id The ID of the turnout to fetch
     * @returns The turnout if found
     */
    getTurnout(id: number): Promise<Turnout> {
        return new Promise<Turnout>((resolve) => {
            type Results = {
                idturnouts: number;
                name: string | null;
                description: string | null;
                primary_direction: number | null;
                secondary_direction: number | null;
                state: boolean;
                coordinate: string;
            }[];
            const sql = 'SELECT * FROM turnouts WHERE idturnouts = ?';
            const inserts = [id];
            dbConnection.query(
                sqlFormat(sql, inserts),
                (error, results: Results) => {
                    if (error) throw error;
                    const turnouts: Turnout[] = results.map((value) => {
                        return {
                            id: value.idturnouts,
                            name: value.name || '',
                            primaryDirection: value.primary_direction || 0,
                            secondaryDirection: value.secondary_direction || 0,
                            state: value.state
                                ? TurnoutState.thrown
                                : TurnoutState.closed,
                            coordinate: JSON.parse(value.coordinate),
                            connections: [],
                        };
                    });
                    resolve(turnouts[0]);
                }
            );
        }).then((turnout) => {
            if (turnout) {
                const sql =
                    'SELECT idturnoutLinks FROM turnoutLinks WHERE start = ? OR end = ?';
                const inserts = [turnout.id, turnout.id];
                type Results = {
                    idturnoutLinks: number;
                }[];
                dbConnection.query(
                    sqlFormat(sql, inserts),
                    (error, results: Results) => {
                        if (error) throw error;
                        results.forEach((result) => {
                            turnout.connections.push(result.idturnoutLinks);
                        });
                    }
                );
            }
            return turnout;
        });
    }
}

type RouteID = number;

/**
 * Manages and allocates RouteIDs
 */
class routeIdAllocator {
    private nextRouteID = 1;
    private freedRouteIDs: number[] = [];

    /**
     * Marks a previously allocated routeID as available
     * @param routeID The id to free
     */
    freeRouteID(routeID: RouteID) {
        this.freedRouteIDs.push(routeID);
    }

    /**
     * Gets a new ID for a route that is guaranteed to be unique
     * @returns A new routeID
     */
    newRouteID(): RouteID {
        let newRouteID: number;
        if (this.freedRouteIDs.length !== 0) {
            const newRouteIDUndef = this.freedRouteIDs.shift();
            if (newRouteIDUndef) {
                newRouteID = newRouteIDUndef;
            } else {
                newRouteID = 0;
            }
        } else {
            newRouteID = this.nextRouteID;
            this.nextRouteID++;
        }
        return newRouteID;
    }
}
