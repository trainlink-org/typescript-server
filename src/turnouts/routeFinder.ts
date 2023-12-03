/* eslint-disable @typescript-eslint/restrict-template-expressions */
import type { TurnoutMap } from './index';
import type { TurnoutGraph } from './graph';
import { PriorityQueue } from './priorityQueue';

import {
    type RouteObject,
    type Destination,
    type MapPoint,
    type TurnoutLink,
    type CurrentTurnoutState,
    type Node,
    TurnoutState,
    isTurnout,
} from '@trainlink-org/trainlink-types';
import { log } from '../logger';
import type { Database } from 'sqlite';

/**
 * Finds the shortest path between two destinations using Dijkstra's algorithm
 * @param externalStart Destination to start the route at
 * @param externalEnd Destination to end the route at
 * @param graph The {@link TurnoutGraph} to use to find routes
 * @returns A promise that resolves to an array of turnouts between the start and end
 */
export async function findPath(
    externalStart: Destination,
    externalEnd: Destination,
    graph: TurnoutGraph,
): Promise<number[]> {
    const start = graph.getVertex(externalStart.id);
    const end = graph.getVertex(externalEnd.id);
    if (!start || !end) throw 'Start invalid';
    log('\nGraph traversal\n---------------');

    /** Stores the distance of each vertex from the start, -1 indicates infinity. */
    const distances: Map<MapPoint, number> = new Map();

    // Add all vertices to distances
    graph.getVertices().forEach((vertex) => {
        distances.set(vertex, -1);
    });
    distances.set(start, 0);

    /** A priority queue to store all the vertices that are yet to be explored, ordered from closest to furthest. */
    const queue: PriorityQueue<MapPoint> = new PriorityQueue((a, b) => {
        return (distances.get(a) || 0) > (distances.get(b) || 0);
    });

    /** An array that stores all the visited vertices, stops the same vertices being repeatedly visited. */
    const visited: MapPoint[] = [];

    /** Stores the previous vertexes for each destination, used by {@link pathToTurnouts} and to check turnout directions. */
    const prevVertex: Map<MapPoint, MapPoint> = new Map();

    queue.add(start); // Adds the first vertex to the queue

    return new Promise<number[]>((resolve, reject) => {
        // Keep going till the queue is empty
        while (queue.size > 0) {
            // Get the first vertex in the queue
            const vertex = queue.pop();
            if (!vertex) break;

            visited.push(vertex); // Mark it as visited...
            const neighbours = graph.getNeighbours(vertex); // ...and find all it's neighbours

            // Iterate over the neighbours
            neighbours.forEach((neighbour) => {
                // Don't bother exploring it if it's already been visited
                if (visited.includes(neighbour.vertex)) return;

                // If it's a turnout perform additional checks to make sure we aren't trying to set it both the primary and secondary direction
                if (isTurnout(vertex)) {
                    if (
                        neighbour.edge.id === vertex.primaryDirection ||
                        neighbour.edge.id === vertex.secondaryDirection
                    ) {
                        const prev = prevVertex.get(vertex);
                        if (prev) {
                            const prevEdge = graph.getEdge(prev, vertex);
                            if (
                                prevEdge &&
                                (prevEdge.id === vertex.primaryDirection ||
                                    prevEdge.id === vertex.secondaryDirection)
                            ) {
                                return;
                            }
                        }
                    }
                }

                // Find the distance between the neighbour and start of the route
                const newDistance =
                    (distances.get(vertex) || 0) + neighbour.edge.length;

                // If the new distance is shorter than the current one for the neighbour, or it doesn't have a distance yet, set this as the distance.
                if (
                    newDistance < (distances.get(neighbour.vertex) || -1) ||
                    (distances.get(neighbour.vertex) || -1) === -1
                ) {
                    distances.set(neighbour.vertex, newDistance);

                    prevVertex.set(neighbour.vertex, vertex);
                    queue.remove(neighbour.vertex);
                    queue.add(neighbour.vertex);
                }
            });

            // If we have reached the end of the queue (no more vertices to explore)
            if (queue.size === 0) {
                if (distances.get(end) === -1) {
                    // No path between the start and end was found
                    reject('Bad route');
                } else {
                    // Makes the path from the points explored
                    const path = constructPath(start, end, prevVertex);
                    log(`Path: ${path}`);
                    resolve(path);
                }
            }
        }
    }).then((path) => {
        // Check a route was found
        if (distances.get(end) && distances.get(end) !== -1) {
            return path;
        }
        throw 'Not possible';
    });
}

/**
 * Creates the path between two Destinations from the output of Dijkstra's algorithm
 * @param start The start destination for the path
 * @param end The end destination for the path
 * @param prevPoints A map of the previous vertices for each vertex
 * @returns An array containing the IDs of the turnouts to set
 */
function constructPath(
    start: MapPoint,
    end: MapPoint,
    prevPoints: Map<MapPoint, MapPoint>,
): number[] {
    // A array to store the path through the graph
    const pointPath: Array<number> = [];

    // Starting from the end
    pointPath.push(end.id);

    //Define a mutable endpoint
    let traversalEnd: MapPoint = end;
    // Work backwards through the array, recording the path
    while (start !== traversalEnd) {
        traversalEnd = prevPoints.get(traversalEnd) || {
            id: NaN,
            coordinate: { x: 0, y: 0 },
        };
        pointPath.unshift(traversalEnd.id); // Add the turnout id to the front of the array
    }
    return pointPath;
}

/**
 * Converts the array generated by {@link findPath} to a route of turnouts that can be set.
 * @param path An array of IDs of turnouts and destinations
 * @param turnoutMap Turnout map to use when converting the path
 * @param graph The graph of the turnouts, used to find the path
 * @returns A promise that resolves to give the route to set
 */
export async function pathToTurnouts(
    path: number[],
    turnoutMap: TurnoutMap,
    graph: TurnoutGraph,
): Promise<RouteObject> {
    // Creates an array to store the turnouts that need to be changed
    const turnoutStates: CurrentTurnoutState[] = [];

    // Iterate over the path, ignoring the destinations at each end
    for (let i = 1; i < path.length - 1; i++) {
        const point = path[i];
        // Ignore it if its a destination

        if (
            !(await turnoutMap.getDestination(point)) &&
            (await turnoutMap.getTurnout(point))
        ) {
            const turnout = turnoutMap.getTurnout(point);
            //TODO implement error handling
            void turnout.then(async (turnout) => {
                if (turnout) {
                    // Will never be false due to prev if
                    // Find the primary and secondary link for the turnout
                    const primaryLink = await turnoutMap.getLink(
                        turnout.primaryDirection,
                    );
                    const secondaryLink = await turnoutMap.getLink(
                        turnout.secondaryDirection,
                    );
                    // Make sure they aren't undefined
                    if (primaryLink && secondaryLink) {
                        // Get the start and ends of each link
                        const primaryLinkEnds = [
                            primaryLink.start,
                            primaryLink.end,
                        ];
                        const secondaryLinkEnds = [
                            secondaryLink.start,
                            secondaryLink.end,
                        ];
                        // Work out which way to throw the turnout
                        if (
                            primaryLinkEnds.includes(path[i - 1]) ||
                            primaryLinkEnds.includes(path[i + 1])
                        ) {
                            turnoutStates.push({
                                id: turnout.id,
                                state: TurnoutState.closed,
                            });
                        } else if (
                            secondaryLinkEnds.includes(path[i - 1]) ||
                            secondaryLinkEnds.includes(path[i + 1])
                        ) {
                            turnoutStates.push({
                                id: turnout.id,
                                state: TurnoutState.thrown,
                            });
                        }
                    }
                }
            });
        }
    }
    // Find the links used by the route (used for highlighting and allocation)
    const links: TurnoutLink[] = [];
    for (let i = 0; i < path.length; i++) {
        const currentTurnout = await turnoutMap.getTurnout(path[i]);
        const nextTurnout = await turnoutMap.getTurnout(path[i + 1]);
        const mapPoint: MapPoint | undefined =
            path[i] <= 0
                ? await turnoutMap.getDestination(path[i])
                : currentTurnout;
        const nextMapPoint: MapPoint | undefined =
            path[i + 1] <= 0
                ? await turnoutMap.getDestination(path[i + 1])
                : nextTurnout;
        if (mapPoint && nextMapPoint) {
            const edge = graph.getEdge(mapPoint, nextMapPoint);
            if (edge) links.push(edge);
        }
    }

    // Find the start and end of the path
    const start = await turnoutMap.getDestination(path[0]);
    const end = await turnoutMap.getDestination(path[path.length - 1]);

    return new Promise<RouteObject>((resolve, reject) => {
        // Check if undefined
        if (start && end) {
            /** Return a {@link RouteObject} */
            log({
                start: start,
                end: end,
                links: links,
                turnouts: turnoutStates,
            });
            resolve({
                start: start,
                end: end,
                links: links,
                turnouts: turnoutStates,
            });
        } else reject();
    });
}

export async function pathToTurnoutsNew(
    path: number[],
    turnoutMap: TurnoutMap,
    dbConnection: Database,
): Promise<RouteObject> {
    console.log('Path to turnouts');
    // Creates an array to store the turnouts that need to be changed
    const turnoutStates: CurrentTurnoutState[] = [];

    // Iterate over the path, ignoring the destinations at each end
    for (let i = 1; i < path.length - 1; i++) {
        const point = path[i];
        // Ignore it if its a destination

        if (
            !(await turnoutMap.getDestination(point)) &&
            (await turnoutMap.getTurnout(point))
        ) {
            const turnout = turnoutMap.getTurnout(point);
            //TODO implement error handling
            void turnout.then(async (turnout) => {
                if (turnout) {
                    // Will never be false due to prev if
                    // Find the primary and secondary link for the turnout
                    const primaryLink = await turnoutMap.getLink(
                        turnout.primaryDirection,
                    );
                    const secondaryLink = await turnoutMap.getLink(
                        turnout.secondaryDirection,
                    );
                    // Make sure they aren't undefined
                    if (primaryLink && secondaryLink) {
                        // Get the start and ends of each link
                        const primaryLinkEnds = [
                            primaryLink.start,
                            primaryLink.end,
                        ];
                        const secondaryLinkEnds = [
                            secondaryLink.start,
                            secondaryLink.end,
                        ];
                        // Work out which way to throw the turnout
                        if (
                            primaryLinkEnds.includes(path[i - 1]) ||
                            primaryLinkEnds.includes(path[i + 1])
                        ) {
                            turnoutStates.push({
                                id: turnout.id,
                                state: TurnoutState.closed,
                            });
                        } else if (
                            secondaryLinkEnds.includes(path[i - 1]) ||
                            secondaryLinkEnds.includes(path[i + 1])
                        ) {
                            turnoutStates.push({
                                id: turnout.id,
                                state: TurnoutState.thrown,
                            });
                        }
                    }
                }
            });
        }
    }
    // Find the links used by the route (used for highlighting and allocation)
    const links: TurnoutLink[] = [];
    for (let i = 0; i < path.length - 1; i++) {
        console.log(await turnoutMap.getDestination(path[i]));
        const mapPoint = await turnoutMap.getNode(path[i]);
        const nextMapPoint = await turnoutMap.getNode(path[i + 1]);
        // const mapPoint: MapPoint | undefined =
        //     path[i] <= 0
        //         ? await turnoutMap.getDestination(path[i])
        //         : currentTurnout;
        // const nextMapPoint: MapPoint | undefined =
        //     path[i + 1] <= 0
        //         ? await turnoutMap.getDestination(path[i + 1])
        //         : nextTurnout;
        if (mapPoint && nextMapPoint) {
            // const edge = graph.getEdge(mapPoint, nextMapPoint);
            const sql =
                'SELECT linkID FROM Links WHERE (startNodeID = ? AND endNodeID = ?) OR (endNodeID = ? AND startNodeID = ?);';
            type result = {
                linkID: number;
            };
            const inserts = [
                mapPoint.id,
                nextMapPoint.id,
                mapPoint.id,
                nextMapPoint.id,
            ];
            const edge: result | undefined = await dbConnection.get(
                sql,
                inserts,
            );
            if (edge) links.push(await turnoutMap.getLink(edge.linkID));
        }
    }
    console.log(`Links: ${links}`);

    // Find the start and end of the path
    const start = await turnoutMap.getDestination(path[0]);
    const end = await turnoutMap.getDestination(path[path.length - 1]);

    return new Promise<RouteObject>((resolve, reject) => {
        // Check if undefined
        if (start && end) {
            /** Return a {@link RouteObject} */
            log({
                start: start,
                end: end,
                links: links,
                turnouts: turnoutStates,
            });
            resolve({
                start: start,
                end: end,
                links: links,
                turnouts: turnoutStates,
            });
        } else reject();
    });
}

export async function findPathNew(
    startNode: Node,
    endNode: Node,
    dbConnection: Database,
    turnoutMap: TurnoutMap,
): Promise<number[]> {
    console.log(`Pathfinding between ${startNode.id} and ${endNode.id}`);
    // Key: node ID, Value: distance
    const distances: Map<number, number> = new Map();

    // Check if route in cache
    const sql = 'SELECT * FROM RouteCache WHERE startNode = ? AND endNode = ?';
    const inserts = [startNode.id, endNode.id];
    const response = await dbConnection.get(sql, inserts);
    if (response) {
        console.log('Cache hit');
        return findPathFromCache(startNode, endNode, dbConnection, turnoutMap);
    }

    console.log('Cache miss');

    /** Zero if not same line, otherwise line number */
    const sameLine = await checkSameLine(startNode, endNode);
    console.log(sameLine);

    const useMainline = await checkUseMainline(startNode, endNode);
    console.log(useMainline);
    (await turnoutMap.getNodes()).forEach((node) => {
        distances.set(node.id, -1);
    });
    distances.set(startNode.id, 0);
    console.log(distances);
    /** A priority queue to store all the vertices that are yet to be explored, ordered from closest to furthest. */
    const queue: PriorityQueue<Node> = new PriorityQueue((a, b) => {
        return (distances.get(a.id) || 0) > (distances.get(b.id) || 0);
    });

    /** An array that stores all the visited vertices, stops the same vertices being repeatedly visited. */
    const visited: Node[] = [];

    /** Stores the previous vertexes for each destination, used by {@link pathToTurnouts} and to check turnout directions. */
    // Key: Current node id, Value: Previous node id
    const prevVertex: Map<number, number> = new Map();

    queue.add(startNode); // Adds the first vertex to the queue
    // let error = false;

    return new Promise(async (resolve, reject) => {
        // reject([0]);
        // Keep going until queue is empty
        while (queue.size > 0) {
            // Get the first vertex in the queue
            const vertex = queue.pop();
            if (!vertex) break;
            // if (!vertex) throw 'error';

            visited.push(vertex); // Mark it as visited...
            // error = true;
            // if (error) {
            //     break;
            // }
            await getNeighbours(vertex, dbConnection)
                .then((neighbours) => {
                    // Iterate over the neighbours

                    // neighbours.forEach(async (neighbour) => {
                    const promises: Promise<void>[] = [];
                    neighbours.forEach((neighbour) => {
                        const promise = new Promise<void>((resolve) => {
                            // Don't bother exploring it if it's already been visited
                            if (visited.includes(neighbour)) return;

                            // Check if the neighbour is allowed
                            if (!isValidNeighbour()) return;

                            // Find the distance between the neighbour and start of the route

                            getNeighbourDistance(
                                vertex,
                                neighbour,
                                dbConnection,
                            ).then((newDistance) => {
                                newDistance =
                                    (distances.get(vertex.id) || 0) +
                                    newDistance;

                                // If the new distance is shorter than the current one for the neighbour, or it doesn't have a distance yet, set this as the distance.
                                if (
                                    newDistance <
                                        (distances.get(neighbour.id) || -1) ||
                                    (distances.get(neighbour.id) || -1) === -1
                                ) {
                                    distances.set(neighbour.id, newDistance);
                                    prevVertex.set(neighbour.id, vertex.id);
                                    queue.remove(neighbour);
                                    queue.add(neighbour);
                                    resolve();
                                } else {
                                    resolve();
                                }
                            });
                        });
                        promises.push(promise);
                    });
                    return Promise.all(promises);
                })
                .then(() => {
                    // If we have reached the end of the queue (no more vertices to explore)
                    if (queue.size === 0) {
                        if (distances.get(endNode.id) === -1) {
                            // No path between the start and end was found
                            console.log('rejecting');
                            reject('Bad route');
                        } else {
                            // Makes the path from the points explored
                            const path = constructPathNew(
                                startNode,
                                endNode,
                                prevVertex,
                            );
                            log(`Path: ${path}`);
                            console.log('Resolving');
                            resolve(path);
                        }
                    }
                });
        }
        console.log('Left loop');
    });
}

function checkSameLine(firstNode: Node, secondNode: Node): Promise<number> {
    console.log('checkSameLine');
    return new Promise((resolve) => {
        resolve(0);
    });
}

function checkUseMainline(start: Node, end: Node): Promise<boolean> {
    console.log('checkUseMainline');
    return new Promise((resolve) => {
        resolve(false);
    });
}

export function getNeighbours(
    node: Node,
    dbConnection: Database,
): Promise<Node[]> {
    const sql = `
        SELECT
            n.*
        FROM
            Nodes n,
            Links l
        WHERE
            (n.nodeID = l.startNodeID
                OR n.nodeID = l.endNodeID )
            AND (? = l.startNodeID
                OR ? = l.endNodeID)
            AND n.nodeID <> ?;

    `;
    const inserts = [node.id, node.id, node.id];
    type Results = {
        nodeID: number;
        name: string;
        description: string;
        nodeType: string;
        coordinate: string;
        state: boolean;
    }[];
    // console.log(await dbConnection.all(sql, inserts));
    // console.log('getNeighbours');
    // dbConnection.get('SELECT * FROM Test').catch((error) => {
    //     throw error;
    // });
    // const results = await dbConnection
    return dbConnection
        .all(sql, inserts)
        .then((results: Results) => {
            return results.map((result) => {
                return {
                    id: result.nodeID,
                    name: result.name,
                    type: result.nodeType,
                    state: result.state
                        ? TurnoutState.thrown
                        : TurnoutState.closed,
                    coordinate: JSON.parse(result.coordinate),
                };
            });
        })
        .catch(() => {
            return [
                {
                    id: 0,
                    name: '',
                    type: '',
                    state: TurnoutState.closed,
                    coordinate: { x: 0, y: 0 },
                },
            ];
        });
    // return results;
}

function isValidNeighbour(): boolean {
    return true;
}

function getNeighbourDistance(
    vertex: Node,
    neighbour: Node,
    dbConnection: Database,
): Promise<number> {
    const sql = `
        SELECT
            l.linkLength
        FROM
            Links l
        WHERE
            (startNodeID = ?
                AND endNodeID = ?)
            OR (startNodeID = ?
                AND endNodeID = ?)
    `;
    const inserts = [vertex.id, neighbour.id, neighbour.id, vertex.id];
    type Result = {
        linkLength: number;
    };
    return dbConnection.get(sql, inserts).then((result: Result) => {
        return result.linkLength;
    });
}

function findPathFromCache(
    startNode: Node,
    endNode: Node,
    dbConnection: Database,
    turnoutMap: TurnoutMap,
): Promise<number[]> {
    return new Promise((resolve) => {
        resolve([]);
    });
}

/**
 * Creates the path between two Destinations from the output of Dijkstra's algorithm
 * @param start The start destination for the path
 * @param end The end destination for the path
 * @param prevPoints A map of the previous vertices for each vertex
 * @returns An array containing the IDs of the turnouts to set
 */
function constructPathNew(
    start: Node,
    end: Node,
    prevPoints: Map<number, number>,
): number[] {
    // A array to store the path through the graph
    const pointPath: Array<number> = [];

    // Starting from the end
    pointPath.push(end.id);

    //Define a mutable endpoint
    let traversalEnd: number = end.id;
    // Work backwards through the array, recording the path
    while (start.id !== traversalEnd) {
        // console.log('loop2');
        // traversalEnd = prevPoints.get(traversalEnd) || {
        //     id: NaN,
        //     coordinate: { x: 0, y: 0 },
        //     name: '',
        //     type: '',
        //     state: false,
        // };
        traversalEnd = prevPoints.get(traversalEnd) || -1;
        pointPath.unshift(traversalEnd); // Add the turnout id to the front of the array
    }
    return pointPath;
}
