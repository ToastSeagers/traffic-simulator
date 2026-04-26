export class TrafficLightSystem {
    constructor() {
        /** @type {Map<string, TrafficLightController>} */
        this.controllers = new Map();
    }

    /**
     * Rebuilds the controllers based on the current graph state.
     * @param {Graph} graph 
     */
    init(graph) {
        this.controllers.clear();
        for (const node of graph.nodes.values()) {
            if (node.type === 'traffic_light') {
                const incomingEdges = [];
                for (const edge of graph.edges.values()) {
                    if (edge.endNode === node) {
                        incomingEdges.push(edge);
                    }
                }
                
                if (incomingEdges.length > 0) {
                    this.controllers.set(node.id, new TrafficLightController(node, incomingEdges));
                }
            }
        }
    }

    update(deltaTimeMs) {
        for (const controller of this.controllers.values()) {
            controller.update(deltaTimeMs);
        }
    }

    /**
     * Gets the current light state ('green', 'amber', 'red') for a specific edge.
     */
    getState(edge) {
        if (!edge.endNode || edge.endNode.type !== 'traffic_light') {
            return 'green'; // No traffic light, free to go (handling stop signs separately later)
        }
        const controller = this.controllers.get(edge.endNode.id);
        if (controller) {
            return controller.getStateForEdge(edge);
        }
        return 'green';
    }
}

class TrafficLightController {
    constructor(node, incomingEdges) {
        this.node = node;
        this.incomingEdges = incomingEdges;

        // Group edges into phases (opposite pairs)
        const phaseObjects = groupEdgesIntoPhases(incomingEdges);
        this.phases = phaseObjects.map(p => p.edges);
        this.currentPhaseIndex = 0;

        // Configuration (in milliseconds)
        this.AMBER_TIME = 3000;
        this.ALL_RED_TIME = 2000; // Clearing phase

        // State machine
        this.state = 'green';
        this.timer = this.getGreenTimeForCurrentPhase();
    }

    getGreenTimeForCurrentPhase() {
        if (!this.node || !this.node.phaseTimings) return 15000;
        // Phase timings are stored in seconds, convert to ms
        const seconds = this.node.phaseTimings[this.currentPhaseIndex];
        return (seconds || 15) * 1000;
    }

    update(deltaTimeMs) {
        if (this.phases.length === 0) return;

        this.timer -= deltaTimeMs;

        if (this.timer <= 0) {
            this.transitionState();
        }
    }

    transitionState() {
        if (this.state === 'green') {
            this.state = 'amber';
            this.timer = this.AMBER_TIME;
        } else if (this.state === 'amber') {
            this.state = 'all_red';
            this.timer = this.ALL_RED_TIME;
        } else if (this.state === 'all_red') {
            this.state = 'green';
            // Move to next phase group
            this.currentPhaseIndex = (this.currentPhaseIndex + 1) % this.phases.length;
            this.timer = this.getGreenTimeForCurrentPhase();
        }
    }

    getStateForEdge(edge) {
        if (this.phases.length === 0) return 'green';

        const activePhaseGroup = this.phases[this.currentPhaseIndex];
        const isEdgeInActivePhase = activePhaseGroup.includes(edge);

        if (!isEdgeInActivePhase) {
            return 'red';
        }

        if (this.state === 'all_red') {
            return 'red';
        }

        return this.state; // 'green' or 'amber'
    }
}

export function getCardinalDirection(angle) {
    if (angle >= 337.5 || angle < 22.5) return 'East';
    if (angle >= 22.5 && angle < 67.5) return 'North-East';
    if (angle >= 67.5 && angle < 112.5) return 'North';
    if (angle >= 112.5 && angle < 157.5) return 'North-West';
    if (angle >= 157.5 && angle < 202.5) return 'West';
    if (angle >= 202.5 && angle < 247.5) return 'South-West';
    if (angle >= 247.5 && angle < 292.5) return 'South';
    if (angle >= 292.5 && angle < 337.5) return 'South-East';
    return 'Unknown';
}

export function groupEdgesIntoPhases(edges) {
    if (edges.length === 0) return [];
    
    // Calculate incoming angle for each edge (using the last segment before the node)
    const edgeAngles = edges.map(edge => {
        let startP;
        if (edge.controlPoints.length > 0) {
            startP = edge.controlPoints[edge.controlPoints.length - 1];
        } else {
            startP = edge.startNode;
        }
        const endP = edge.endNode;
        
        const dy = endP.lat - startP.lat;
        const dx = endP.lng - startP.lng;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
        if (angle < 0) angle += 360; // 0 to 360
        return { edge, angle, cardinal: getCardinalDirection(angle) };
    });

    const phases = [];
    const unassigned = [...edgeAngles];

    while (unassigned.length > 0) {
        const current = unassigned.shift();
        const phaseGroupEdges = [current.edge];
        const phaseGroupCardinals = [current.cardinal];

        // Find opposite
        const oppositeAngle = (current.angle + 180) % 360;
        let bestMatchIdx = -1;
        let minDiff = 45; // Max 45 degrees tolerance for "opposite"

        for (let i = 0; i < unassigned.length; i++) {
            const diff = Math.abs(unassigned[i].angle - oppositeAngle);
            const wrapDiff = Math.abs(diff - 360);
            const finalDiff = Math.min(diff, wrapDiff);

            if (finalDiff < minDiff) {
                minDiff = finalDiff;
                bestMatchIdx = i;
            }
        }

        if (bestMatchIdx !== -1) {
            phaseGroupEdges.push(unassigned[bestMatchIdx].edge);
            phaseGroupCardinals.push(unassigned[bestMatchIdx].cardinal);
            unassigned.splice(bestMatchIdx, 1);
        }

        phases.push({
            edges: phaseGroupEdges,
            label: phaseGroupCardinals.join('/')
        });
    }

    return phases;
}
