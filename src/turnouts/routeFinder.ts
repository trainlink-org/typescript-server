/* eslint-disable @typescript-eslint/restrict-template-expressions */
import type { TurnoutGraph } from './graph';
import { PriorityQueue } from './priorityQueue';

import {
    type RouteObject,
    type Destination,
    type MapPoint,
    type Turnout,
    type TurnoutLink,
    type CurrentTurnoutState,
    TurnoutState,
    isTurnout,
} from '@trainlink-org/shared-lib';

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
    graph: TurnoutGraph
): Promise<number[]> {
    const start = graph.getVertex(externalStart.id);
    const end = graph.getVertex(externalEnd.id);
    if (!start || !end) throw 'Start invalid';
    console.log('\nGraph traversal\n---------------');

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
                    console.log(`Path: ${path}`);
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
    prevPoints: Map<MapPoint, MapPoint>
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
 * @param destinations A map of the defined destinations
 * @param turnouts A map of the defined turnouts
 * @param turnoutLinks A map of the defined turnout links
 * @param graph The graph of the turnouts, used to find the path
 * @returns A promise that resolves to give the route to set
 */
export async function pathToTurnouts(
    path: number[],
    destinations: (id: number) => Promise<Destination>,
    // allDestinations: () => Promise<Destination[]>,
    turnouts: (id: number) => Promise<Turnout>,
    // allTurnouts: () => Promise<Turnout[]>,
    turnoutLinks: (id: number) => Promise<TurnoutLink>,
    graph: TurnoutGraph
): Promise<RouteObject> {
    console.log('pathToTurnouts');
    // Creates an array to store the turnouts that need to be changed
    const turnoutStates: CurrentTurnoutState[] = [];

    // Iterate over the path, ignoring the destinations at each end
    for (let i = 1; i < path.length - 1; i++) {
        const point = path[i];
        // Ignore it if its a destination

        if (!(await destinations(point)) && (await turnouts(point))) {
            const turnout = turnouts(point);
            //TODO implement error handling
            void turnout.then(async (turnout) => {
                if (turnout) {
                    // Will never be false due to prev if
                    // Find the primary and secondary link for the turnout
                    const primaryLink = await turnoutLinks(
                        turnout.primaryDirection
                    );
                    const secondaryLink = await turnoutLinks(
                        turnout.secondaryDirection
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
        const currentTurnout = await turnouts(path[i]);
        const nextTurnout = await turnouts(path[i + 1]);
        const mapPoint: MapPoint | undefined =
            path[i] <= 0 ? await destinations(path[i]) : currentTurnout;
        const nextMapPoint: MapPoint | undefined =
            path[i + 1] <= 0 ? await destinations(path[i + 1]) : nextTurnout;
        if (mapPoint && nextMapPoint) {
            const edge = graph.getEdge(mapPoint, nextMapPoint);
            if (edge) links.push(edge);
        }
    }

    // Find the start and end of the path
    const start = await destinations(path[0]);
    const end = await destinations(path[path.length - 1]);

    return new Promise<RouteObject>((resolve, reject) => {
        // Check if undefined
        if (start && end) {
            /** Return a {@link RouteObject} */
            console.log({
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
