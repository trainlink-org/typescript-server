import type { MapPoint, TurnoutLink } from '@trainlink-org/shared-lib';

/**
 * A undirected graph with weighted edges, used to represent the physical layout
 * of a model railway.
 *
 * Implemented using an adjacency list
 */
export class TurnoutGraph {
    private _adjList: Map<MapPoint, adjVertex[]> = new Map();
    private _turnoutIDs: Map<number, MapPoint> = new Map();
    private _verticesNum = 0;
    private _edgesNum = 0;

    /**
     * Adds a vertex to the graph
     * @param label The {@link MapPoint} that this vertex represents
     */
    addVertex(label: MapPoint) {
        this._adjList.set(label, []);
        this._turnoutIDs.set(label.id, label);
        this._verticesNum += 1;
    }

    /**
     * Adds a edge to the graph in the form of a {@link TurnoutLink}
     * @param edge The {@link TurnoutLink} to add to the graph
     */
    addEdge(edge: TurnoutLink) {
        const startPoint = this._turnoutIDs.get(edge.start);
        const endPoint = this._turnoutIDs.get(edge.end);
        if (startPoint && endPoint) {
            this._adjList
                .get(startPoint)
                ?.push({ vertex: endPoint, edge: edge });
            this._adjList
                .get(endPoint)
                ?.push({ vertex: startPoint, edge: edge });
            this._edgesNum += 1;
        }
    }

    /**
     * Gets all the neighbours for a vertex.
     *
     * A neighbour is a vertex that is directly linked to the vertex.
     * @param vertex The vertex to find the neighbours for
     * @returns a array of {@link adjVertex} containing the adjacent vertex and the link to it
     */
    getNeighbours(vertex: MapPoint): adjVertex[] {
        const internalVertex = this._turnoutIDs.get(vertex.id);
        if (internalVertex) return this._adjList.get(internalVertex) || [];
        return [];
    }

    /**
     * Gets the edge weight between two vertices
     * @param vertexA The first vertex
     * @param vertexB The second vertex
     * @returns The length between them (the edge weight) or -1 if not found
     */
    getEdgeWeight(vertexA: MapPoint, vertexB: MapPoint): number {
        const internalVertexA = this._turnoutIDs.get(vertexA.id);
        const internalVertexB = this._turnoutIDs.get(vertexB.id);
        if (internalVertexA && internalVertexB) {
            return (
                this._adjList.get(internalVertexA)?.filter((value) => {
                    return value.vertex === internalVertexB;
                })[0].edge.length || -1
            );
        }
        return -1;
    }

    /**
     * Gets the edge between two vertices
     * @param vertexA The first vertex
     * @param vertexB The second vertex
     * @returns The edge between them or undefined if not found
     */
    getEdge(vertexA: MapPoint, vertexB: MapPoint) {
        const internalVertexA = this._turnoutIDs.get(vertexA.id);
        const internalVertexB = this._turnoutIDs.get(vertexB.id);
        if (internalVertexA && internalVertexB) {
            return this._adjList.get(internalVertexA)?.filter((value) => {
                return value.vertex === internalVertexB;
            })[0].edge;
        }
    }

    /**
     * Checks if the graph contains a vertex
     * @param vertex The vertex to search for
     * @returns `true` if present, `false` if not
     */
    hasVertex(vertex: MapPoint): boolean {
        return this._adjList.has(vertex);
    }

    /**
     * Gets a vertex from it's ID
     * @param id The id of the vertex to return
     * @returns The vertex if found
     */
    getVertex(id: number) {
        return this._turnoutIDs.get(id);
    }

    /**
     * The total number of vertices in the graph
     */
    get vertices() {
        return this._verticesNum;
    }

    /**
     * The total number of edges in the graph
     */
    get edges() {
        return this._edgesNum;
    }

    /**
     * Gets all the vertices in the array
     * @returns An array of the vertices
     */
    getVertices() {
        return Array.from(this._adjList.keys());
    }

    toString(): string {
        return (
            '{\n' +
            Array.from(this._adjList.entries())
                .map((value) => {
                    return `\t[${value[0]} => ${value[1].map((value) => {
                        return ` ${value.vertex}(${value.edge.length})`;
                    })}]`;
                })
                .join('\n') +
            '\n}'
        );
    }
}

/**
 * Stores a vertex and the link to it
 */
interface adjVertex {
    vertex: MapPoint;
    edge: TurnoutLink;
}
