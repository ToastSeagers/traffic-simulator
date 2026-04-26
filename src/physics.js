// Haversine formula to calculate distance in metres between two lat/lng points
function getDistanceInMetres(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

export class PhysicsEngine {
    constructor(trafficLights) {
        this.trafficLights = trafficLights;
        this.vehicles = [];
        this.edgeLengthsCache = new Map();
        
        // Spawn timers map: node.id -> time since last spawn (ms)
        this.spawnTimers = new Map();

        // Analytics
        this.totalJourneyTimesMs = 0;
        this.completedJourneys = 0;
        this.currentBottleneckName = 'None';

        // Throughput Sliding Windows (1 minute)
        this.spawnTimestamps = [];
        this.despawnTimestamps = [];
    }

    getEdgeLength(edge) {
        if (this.edgeLengthsCache.has(edge.id)) {
            return this.edgeLengthsCache.get(edge.id);
        }

        const points = [edge.startNode, ...edge.controlPoints, edge.endNode];
        let length = 0;
        for (let i = 0; i < points.length - 1; i++) {
            length += getDistanceInMetres(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
        }

        this.edgeLengthsCache.set(edge.id, length);
        return length;
    }

    /**
     * Finds the lat/lng position of a vehicle given its progress along an edge.
     */
    getVehiclePosition(vehicle) {
        const edge = vehicle.edge;
        const points = [edge.startNode, ...edge.controlPoints, edge.endNode];
        
        let remainingProgress = vehicle.progress;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            const segDist = getDistanceInMetres(p1.lat, p1.lng, p2.lat, p2.lng);
            
            if (remainingProgress <= segDist) {
                // Interpolate
                const ratio = segDist === 0 ? 0 : remainingProgress / segDist;
                return {
                    lat: p1.lat + (p2.lat - p1.lat) * ratio,
                    lng: p1.lng + (p2.lng - p1.lng) * ratio,
                    // calculate heading
                    heading: Math.atan2(p2.lat - p1.lat, p2.lng - p1.lng)
                };
            }
            remainingProgress -= segDist;
        }

        // Off the end (shouldn't happen often if we handle routing correctly)
        const lastP = points[points.length - 1];
        const prevP = points[points.length - 2];
        return {
            lat: lastP.lat,
            lng: lastP.lng,
            heading: Math.atan2(lastP.lat - prevP.lat, lastP.lng - prevP.lng)
        };
    }

    update(deltaTimeMs, graph) {
        const dt = deltaTimeMs / 1000; // seconds

        this.handleSpawning(dt, graph);
        this.updateVehicles(dt, graph);
        this.filterThroughputWindows();
    }

    filterThroughputWindows() {
        const now = performance.now();
        const oneMinuteAgo = now - 60000;
        
        while (this.spawnTimestamps.length > 0 && this.spawnTimestamps[0] < oneMinuteAgo) {
            this.spawnTimestamps.shift();
        }
        while (this.despawnTimestamps.length > 0 && this.despawnTimestamps[0] < oneMinuteAgo) {
            this.despawnTimestamps.shift();
        }
    }

    getSystemInflow() {
        return this.spawnTimestamps.length;
    }

    getSystemOutflow() {
        return this.despawnTimestamps.length;
    }

    handleSpawning(dt, graph) {
        for (const node of graph.nodes.values()) {
            if (node.type !== 'inflow_outflow' || node.inflowRate <= 0) continue;

            const outgoingEdges = node.edges;
            if (outgoingEdges.length === 0) continue;

            const spawnIntervalMs = (60 / node.inflowRate) * 1000;
            
            let timer = this.spawnTimers.get(node.id) || 0;
            timer += (dt * 1000);

            if (timer >= spawnIntervalMs) {
                // Pick random outgoing edge
                const edge = outgoingEdges[Math.floor(Math.random() * outgoingEdges.length)];

                // Check if there is space at the start of the edge
                const spaceClear = this.vehicles.every(v => {
                    if (v.edge !== edge) return true;
                    return v.progress > 8; // 8 metres clearance
                });

                if (spaceClear) {
                    const vehicle = new Vehicle(edge);
                    vehicle.speed = Math.min(5, vehicle.v0); 
                    this.vehicles.push(vehicle);
                    this.spawnTimestamps.push(performance.now());
                    timer -= spawnIntervalMs; // Subtract instead of reset to 0 to keep rate accurate
                } else {
                    timer = spawnIntervalMs; // Max out
                }
            }
            this.spawnTimers.set(node.id, timer);
        }
    }

    updateVehicles(dt, graph) {
        // Group vehicles by edge and sort by progress (descending) to find leaders
        const edgeVehicles = new Map();
        for (const v of this.vehicles) {
            if (!edgeVehicles.has(v.edge.id)) {
                edgeVehicles.set(v.edge.id, []);
            }
            edgeVehicles.get(v.edge.id).push(v);
        }

        for (const list of edgeVehicles.values()) {
            list.sort((a, b) => b.progress - a.progress);
        }

        // Calculate accelerations
        for (let i = 0; i < this.vehicles.length; i++) {
            const v = this.vehicles[i];
            const list = edgeVehicles.get(v.edge.id);
            const vIndex = list.indexOf(v);
            
            let leader = null;
            let distanceToLeader = Infinity;
            let leaderSpeed = 0;

            if (vIndex > 0) {
                // There is a vehicle ahead on the same edge
                leader = list[vIndex - 1];
                distanceToLeader = leader.progress - v.progress - leader.length;
                leaderSpeed = leader.speed;
            }

            // Check traffic light state
            const edgeLength = this.getEdgeLength(v.edge);
            const distanceToIntersection = edgeLength - v.progress;

            // If we are close to the intersection and there's no vehicle closer than the light
            if (distanceToIntersection < Math.min(distanceToLeader, 100)) {
                const lightState = this.trafficLights.getState(v.edge);
                
                if (lightState === 'red' || lightState === 'amber') {
                    // Treat the red light as a stopped vehicle exactly at the intersection
                    distanceToLeader = distanceToIntersection;
                    leaderSpeed = 0;
                }
            }

            // Calculate IDM acceleration
            v.acceleration = this.calculateIDM(v, distanceToLeader, leaderSpeed);
        }

        // Apply kinematics and routing
        for (let i = this.vehicles.length - 1; i >= 0; i--) {
            const v = this.vehicles[i];
            
            v.speed += v.acceleration * dt;
            if (v.speed < 0) v.speed = 0; // Prevent reversing
            
            v.progress += v.speed * dt;

            const edgeLength = this.getEdgeLength(v.edge);
            
            if (v.progress >= edgeLength) {
                // Route to next edge
                this.routeVehicle(v);
                if (v.markedForDespawn) {
                    const now = performance.now();
                    this.totalJourneyTimesMs += (now - v.spawnTime);
                    this.completedJourneys++;
                    this.despawnTimestamps.push(now);
                    this.vehicles.splice(i, 1);
                }
            }
        }

        this.calculateBottleneck(graph);
    }

    calculateIDM(vehicle, distanceToLeader, leaderSpeed) {
        // Intelligent Driver Model (IDM) equation
        const v = vehicle.speed;
        const v0 = vehicle.v0; // Desired speed
        const s0 = vehicle.s0; // Minimum gap
        const T = vehicle.T; // Safe time headway
        const a = vehicle.a; // Max acceleration
        const b = vehicle.b; // Comfortable deceleration
        const deltaV = v - leaderSpeed;

        // Desired dynamic gap
        const s_star = s0 + Math.max(0, (v * T) + ((v * deltaV) / (2 * Math.sqrt(a * b))));

        // Acceleration
        let accel = a * (1 - Math.pow(v / v0, 4) - Math.pow(s_star / distanceToLeader, 2));

        // Cap acceleration/deceleration
        if (accel < -b * 2) accel = -b * 2; // Emergency braking
        
        return accel;
    }

    routeVehicle(v) {
        const currentNode = v.edge.endNode;

        if (currentNode.type === 'inflow_outflow' || currentNode.edges.length === 0) {
            // Reached destination or dead end
            v.markedForDespawn = true;
            return;
        }

        const availableEdges = currentNode.edges;

        // Prohibit U-turns (going back to the node we just came from) unless it's the only option
        const previousNode = v.edge.startNode;
        let validEdges = availableEdges.filter(e => e.endNode !== previousNode);

        if (validEdges.length === 0) {
            validEdges = availableEdges;
        }

        // Pick random edge
        const nextEdge = validEdges[Math.floor(Math.random() * validEdges.length)];
        
        const overshot = v.progress - this.getEdgeLength(v.edge);
        v.edge = nextEdge;
        v.progress = overshot; // Transfer momentum to next edge
        v.v0 = nextEdge.speedLimit / 3.6;
    }

    calculateBottleneck(graph) {
        let maxStationary = -1;
        let bottleneckNode = null;

        for (const node of graph.nodes.values()) {
            let stationaryCount = 0;
            for (const v of this.vehicles) {
                if (v.edge.endNode === node && v.speed < 1.0) {
                    stationaryCount++;
                }
            }
            if (stationaryCount > maxStationary) {
                maxStationary = stationaryCount;
                bottleneckNode = node;
            }
        }

        if (maxStationary > 2 && bottleneckNode) {
            this.currentBottleneckName = bottleneckNode.name;
        } else {
            this.currentBottleneckName = 'None';
        }
    }
}

class Vehicle {
    constructor(edge) {
        this.edge = edge;
        this.progress = 0; // Metres
        this.speed = 0; // m/s
        this.acceleration = 0; // m/s^2
        this.length = 4.5; // Average car length
        
        // IDM Parameters
        this.v0 = edge.speedLimit / 3.6; // Convert km/h to m/s
        this.s0 = 2.0; // Minimum gap (m)
        this.T = 1.2; // Safe time headway (s)
        this.a = 1.5; // Max acceleration (m/s^2)
        this.b = 2.0; // Comfortable deceleration (m/s^2)
        
        this.spawnTime = performance.now();
        this.markedForDespawn = false;
    }
}
