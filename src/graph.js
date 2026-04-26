/**
 * Represents an intersection in the road network.
 */
export class Node {
    /**
     * @param {string} id - Unique identifier for the node.
     * @param {number} lat - Latitude.
     * @param {number} lng - Longitude.
     */
    constructor(id, lat, lng) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.name = `Intersection ${id.split('_')[1]}`;
        this.type = 'none'; // 'none', 'traffic_light', 'stop_sign', 'inflow_outflow'
        this.inflowRate = 0; // Vehicles per minute
        this.phaseTimings = [15, 15, 15, 15]; // Default green times in seconds for up to 4 phases
        this.edges = []; // Outgoing edges
    }
}

/**
 * Represents a directed road segment between two nodes.
 */
export class Edge {
    /**
     * @param {string} id - Unique identifier for the edge.
     * @param {Node} startNode - Starting intersection.
     * @param {Node} endNode - Ending intersection.
     * @param {number} speedLimit - Speed limit in km/h. Default 60.
     */
    constructor(id, startNode, endNode, speedLimit = 60) {
        this.id = id;
        this.startNode = startNode;
        this.endNode = endNode;
        this.speedLimit = speedLimit;
        this.controlPoints = []; // Array of {lat, lng}
        this.pairedEdgeId = null; // ID of the reverse edge if this is a two-way road
    }
}

/**
 * Directed Graph representing the entire road network.
 */
export class Graph {
    constructor() {
        /** @type {Map<string, Node>} */
        this.nodes = new Map();
        /** @type {Map<string, Edge>} */
        this.edges = new Map();
        this.nodeCounter = 0;
        this.edgeCounter = 0;
    }

    /**
     * Adds a new intersection to the network.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Node} The created node.
     */
    addNode(lat, lng) {
        const id = `node_${this.nodeCounter++}`;
        const node = new Node(id, lat, lng);
        this.nodes.set(id, node);
        return node;
    }

    /**
     * Connects two nodes with a directed edge.
     * @param {Node} startNode 
     * @param {Node} endNode 
     * @param {number} speedLimit 
     * @returns {Edge|null} The created edge, or null if it already exists.
     */
    addEdge(startNode, endNode, speedLimit = 60) {
        // Prevent duplicate edges in the same direction
        if (startNode.edges.some(e => e.endNode === endNode)) {
            return null;
        }

        const id = `edge_${this.edgeCounter++}`;
        const edge = new Edge(id, startNode, endNode, speedLimit);
        startNode.edges.push(edge);
        this.edges.set(id, edge);
        return edge;
    }

    /**
     * Removes a node and all edges connected to it.
     * @param {Node} node 
     */
    removeNode(node) {
        const edgesToRemove = [];
        for (const edge of this.edges.values()) {
            if (edge.startNode === node || edge.endNode === node) {
                edgesToRemove.push(edge);
            }
        }
        for (const edge of edgesToRemove) {
            this.removeEdge(edge);
        }
        this.nodes.delete(node.id);
    }

    /**
     * Removes an edge.
     * @param {Edge} edge 
     */
    removeEdge(edge) {
        const index = edge.startNode.edges.indexOf(edge);
        if (index > -1) {
            edge.startNode.edges.splice(index, 1);
        }
        this.edges.delete(edge.id);
    }

    // --- Save and Load logic ---

    toJSON() {
        const data = {
            nodes: [],
            edges: [],
            nodeCounter: this.nodeCounter,
            edgeCounter: this.edgeCounter
        };

        for (const node of this.nodes.values()) {
            data.nodes.push({
                id: node.id,
                lat: node.lat,
                lng: node.lng,
                name: node.name,
                type: node.type,
                inflowRate: node.inflowRate,
                phaseTimings: [...node.phaseTimings]
            });
        }

        for (const edge of this.edges.values()) {
            data.edges.push({
                id: edge.id,
                startNodeId: edge.startNode.id,
                endNodeId: edge.endNode.id,
                speedLimit: edge.speedLimit,
                controlPoints: [...edge.controlPoints],
                pairedEdgeId: edge.pairedEdgeId
            });
        }

        return JSON.stringify(data, null, 2);
    }

    fromJSON(jsonStr) {
        const data = JSON.parse(jsonStr);
        this.nodes.clear();
        this.edges.clear();
        this.nodeCounter = data.nodeCounter || 0;
        this.edgeCounter = data.edgeCounter || 0;

        // Rebuild nodes
        for (const n of data.nodes) {
            const node = new Node(n.id, n.lat, n.lng);
            node.name = n.name;
            node.type = n.type;
            node.inflowRate = n.inflowRate || 0;
            node.phaseTimings = n.phaseTimings || [15, 15, 15, 15];
            this.nodes.set(node.id, node);
        }

        // Rebuild edges
        for (const e of data.edges) {
            const startNode = this.nodes.get(e.startNodeId);
            const endNode = this.nodes.get(e.endNodeId);
            if (startNode && endNode) {
                const edge = new Edge(e.id, startNode, endNode, e.speedLimit);
                edge.controlPoints = e.controlPoints || [];
                edge.pairedEdgeId = e.pairedEdgeId || null;
                startNode.edges.push(edge);
                this.edges.set(edge.id, edge);
            }
        }
    }
}
