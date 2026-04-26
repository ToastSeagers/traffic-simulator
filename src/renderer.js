export class Renderer {
    constructor(canvasId, mapManager, graph, physics, trafficLights) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.mapManager = mapManager;
        this.graph = graph;
        this.physics = physics;
        this.trafficLights = trafficLights;

        this.selectedNode = null;
        this.selectedEdge = null;
        this.hoveredEdges = null;

        // Colors
        this.NODE_RADIUS = 8;
        this.NODE_COLOR = '#ffffff';
        this.NODE_SELECTED_COLOR = '#ffeb3b'; // Yellow

        this.EDGE_WIDTH = 4;
        this.EDGE_COLOR = '#888888';
        this.EDGE_SELECTED_COLOR = '#ffeb3b'; // Yellow
        
        this.CP_RADIUS = 5;
        this.CP_COLOR = '#03a9f4'; // Blue

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Sync canvas size with its container
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }

    setSelection(node, edge) {
        this.selectedNode = node;
        this.selectedEdge = edge;
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw edges first (so they are under nodes)
        for (const edge of this.graph.edges.values()) {
            this.drawEdge(edge);
        }

        // Draw hovered edges highlight
        if (this.hoveredEdges) {
            for (const edge of this.hoveredEdges) {
                this.drawHoveredEdge(edge);
            }
        }

        // Draw nodes
        for (const node of this.graph.nodes.values()) {
            this.drawNode(node);
        }

        // Draw vehicles if physics exists
        if (this.physics && this.physics.vehicles) {
            for (const vehicle of this.physics.vehicles) {
                this.drawVehicle(vehicle);
            }
        }
    }

    drawNode(node) {
        const { x, y } = this.mapManager.latLngToPixel(node.lat, node.lng);
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.NODE_RADIUS, 0, 2 * Math.PI);
        this.ctx.fillStyle = (node === this.selectedNode) ? this.NODE_SELECTED_COLOR : this.NODE_COLOR;
        this.ctx.fill();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Draw type indicators
        if (node.type === 'traffic_light') {
            if (this.trafficLights && this.trafficLights.controllers.has(node.id)) {
                const controller = this.trafficLights.controllers.get(node.id);
                for (const edge of controller.incomingEdges) {
                    const state = controller.getStateForEdge(edge);
                    let color = '#f44336'; // red
                    if (state === 'green') color = '#4caf50';
                    else if (state === 'amber') color = '#ff9800';

                    // Find angle from node TO the incoming road
                    const prevP = edge.controlPoints.length > 0 ? edge.controlPoints[edge.controlPoints.length - 1] : edge.startNode;
                    const prevPixel = this.mapManager.latLngToPixel(prevP.lat, prevP.lng);
                    const angle = Math.atan2(prevPixel.y - y, prevPixel.x - x);

                    // Draw a pie slice
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    const spread = Math.PI / 8; // 22.5 degrees half-angle
                    this.ctx.arc(x, y, this.NODE_RADIUS - 1, angle - spread, angle + spread);
                    this.ctx.lineTo(x, y);
                    this.ctx.fill();
                    
                    this.ctx.strokeStyle = '#000000';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            } else {
                // Fallback grey dot if uninitialized (e.g., in edit mode before start)
                this.ctx.fillStyle = '#9e9e9e';
                this.ctx.beginPath();
                this.ctx.arc(x, y, this.NODE_RADIUS - 3, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        } else if (node.type === 'stop_sign') {
            this.ctx.fillStyle = '#e91e63'; // Pinkish/Red for stop
            // Draw a small octagon-like shape or just a square
            this.ctx.fillRect(x - 3, y - 3, 6, 6);
        }
    }

    drawVehicle(vehicle) {
        const pos = this.physics.getVehiclePosition(vehicle);
        const { x, y } = this.mapManager.latLngToPixel(pos.lat, pos.lng);
        
        // Approximate pixel length for the vehicle (simplified)
        const vLength = vehicle.length; // meters
        const vWidth = 2; // meters
        
        // Convert heading from map (lat/lng math) to canvas. 
        // Leaflet Y is inverted relative to math Y, canvas Y is inverted too. 
        // We'll draw a generic box for now and rotate.
        
        this.ctx.save();
        this.ctx.translate(x, y);
        // Map heading is atan2(lat, lng). Lat is North (up). On canvas, Y goes down.
        // We might need to adjust the angle. Let's start with a basic negative rotation.
        this.ctx.rotate(-pos.heading);
        
        this.ctx.fillStyle = '#ff5722'; // Orange car
        this.ctx.fillRect(-vLength / 2, -vWidth, vLength, vWidth * 2);
        
        this.ctx.restore();
    }

    drawEdge(edge) {
        const start = this.mapManager.latLngToPixel(edge.startNode.lat, edge.startNode.lng);
        const end = this.mapManager.latLngToPixel(edge.endNode.lat, edge.endNode.lng);
        
        // Build array of all points
        const points = [start];
        for (const cp of edge.controlPoints) {
            points.push(this.mapManager.latLngToPixel(cp.lat, cp.lng));
        }
        points.push(end);

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        
        this.ctx.strokeStyle = (edge === this.selectedEdge) ? this.EDGE_SELECTED_COLOR : this.EDGE_COLOR;
        this.ctx.lineWidth = this.EDGE_WIDTH;
        this.ctx.stroke();

        // Draw arrowhead at the end segment
        const lastP = points[points.length - 1];
        const prevP = points[points.length - 2];
        this.drawArrowhead(prevP.x, prevP.y, lastP.x, lastP.y, this.ctx.strokeStyle);

        // Draw control points if selected
        if (edge === this.selectedEdge) {
            for (let i = 1; i < points.length - 1; i++) {
                this.ctx.beginPath();
                this.ctx.arc(points[i].x, points[i].y, this.CP_RADIUS, 0, 2 * Math.PI);
                this.ctx.fillStyle = this.CP_COLOR;
                this.ctx.fill();
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
        }
    }

    drawHoveredEdge(edge) {
        const start = this.mapManager.latLngToPixel(edge.startNode.lat, edge.startNode.lng);
        const end = this.mapManager.latLngToPixel(edge.endNode.lat, edge.endNode.lng);
        
        const points = [start];
        for (const cp of edge.controlPoints) {
            points.push(this.mapManager.latLngToPixel(cp.lat, cp.lng));
        }
        points.push(end);

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        
        this.ctx.save();
        this.ctx.strokeStyle = '#00ffff'; // Cyan highlight
        this.ctx.lineWidth = this.EDGE_WIDTH + 6;
        this.ctx.globalAlpha = 0.6;
        this.ctx.stroke();
        this.ctx.restore();
    }

    drawArrowhead(fromX, fromY, toX, toY, color) {
        const headlen = 10;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);

        const nodeOffset = this.NODE_RADIUS + 2;
        const arrowX = toX - nodeOffset * Math.cos(angle);
        const arrowY = toY - nodeOffset * Math.sin(angle);

        this.ctx.beginPath();
        this.ctx.moveTo(arrowX, arrowY);
        this.ctx.lineTo(arrowX - headlen * Math.cos(angle - Math.PI / 6), arrowY - headlen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(arrowX - headlen * Math.cos(angle + Math.PI / 6), arrowY - headlen * Math.sin(angle + Math.PI / 6));
        this.ctx.lineTo(arrowX, arrowY);
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    findNodeAt(lat, lng) {
        const targetPixel = this.mapManager.latLngToPixel(lat, lng);
        
        for (const node of this.graph.nodes.values()) {
            const nodePixel = this.mapManager.latLngToPixel(node.lat, node.lng);
            const dist = Math.hypot(nodePixel.x - targetPixel.x, nodePixel.y - targetPixel.y);
            if (dist <= this.NODE_RADIUS + 5) {
                return node;
            }
        }
        return null;
    }

    findControlPointAt(lat, lng) {
        if (!this.selectedEdge) return null;
        
        const targetPixel = this.mapManager.latLngToPixel(lat, lng);
        const edge = this.selectedEdge;

        for (let i = 0; i < edge.controlPoints.length; i++) {
            const cp = edge.controlPoints[i];
            const p = this.mapManager.latLngToPixel(cp.lat, cp.lng);
            const dist = Math.hypot(p.x - targetPixel.x, p.y - targetPixel.y);
            if (dist <= this.CP_RADIUS + 5) {
                return { edge, index: i };
            }
        }
        return null;
    }

    findEdgeAt(lat, lng) {
        const targetPixel = this.mapManager.latLngToPixel(lat, lng);
        const threshold = this.EDGE_WIDTH + 5;

        for (const edge of this.graph.edges.values()) {
            const points = [edge.startNode, ...edge.controlPoints, edge.endNode];
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = this.mapManager.latLngToPixel(points[i].lat, points[i].lng);
                const p2 = this.mapManager.latLngToPixel(points[i+1].lat, points[i+1].lng);
                const dist = this.pointToSegmentDistance(targetPixel.x, targetPixel.y, p1.x, p1.y, p2.x, p2.y);
                if (dist <= threshold) {
                    return edge;
                }
            }
        }
        return null;
    }

    findBestControlPointInsertion(edge, lat, lng) {
        const targetPixel = this.mapManager.latLngToPixel(lat, lng);
        const points = [edge.startNode, ...edge.controlPoints, edge.endNode];
        
        let bestIndex = 0;
        let minDist = Infinity;

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = this.mapManager.latLngToPixel(points[i].lat, points[i].lng);
            const p2 = this.mapManager.latLngToPixel(points[i+1].lat, points[i+1].lng);
            const dist = this.pointToSegmentDistance(targetPixel.x, targetPixel.y, p1.x, p1.y, p2.x, p2.y);
            
            if (dist < minDist) {
                minDist = dist;
                bestIndex = i; // i is the index in the controlPoints array where it should be inserted
            }
        }
        return bestIndex;
    }

    pointToSegmentDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        
        if (len_sq != 0) 
            param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.hypot(dx, dy);
    }
}
