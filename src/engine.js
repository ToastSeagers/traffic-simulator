import { MapManager } from './map.js';
import { Graph } from './graph.js';
import { UIManager } from './ui.js';
import { Renderer } from './renderer.js';
import { TrafficLightSystem } from './trafficLights.js';
import { PhysicsEngine } from './physics.js';

class Engine {
    constructor() {
        this.graph = new Graph();
        this.mapManager = new MapManager('leaflet-map');
        
        this.trafficLights = new TrafficLightSystem();
        this.physics = new PhysicsEngine(this.trafficLights);
        
        this.renderer = new Renderer('simulation-canvas', this.mapManager, this.graph, this.physics, this.trafficLights);
        this.uiManager = new UIManager(this.graph, this.renderer, this.mapManager);

        // Bind map events
        this.mapManager.onMapClick((lat, lng) => {
            this.uiManager.handleMapClick(lat, lng);
            this.renderer.draw(); // Immediate redraw on interaction
        });

        this.mapManager.onMapChange(() => {
            // When panning/zooming, Leaflet moves. The canvas must redraw to keep overlays in sync.
            this.renderer.draw();
        });

        // Loop control
        this.isRunning = false;
        this.lastTime = 0;

        // UI Event overrides for simulation control
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-pause').addEventListener('click', () => this.pause());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());

        // Start rendering loop (always running to draw the canvas, physics updates only when isRunning=true)
        requestAnimationFrame((t) => this.loop(t));
        
        // Initial draw
        this.renderer.draw();
    }

    start() {
        if (!this.isRunning) {
            // Rebuild traffic light controllers based on current graph
            this.trafficLights.init(this.graph);
            this.isRunning = true;
        }
    }

    pause() {
        this.isRunning = false;
    }

    reset() {
        this.isRunning = false;
        this.physics.vehicles = [];
        this.physics.spawnTimers.clear();
        this.updateDashboard();
    }

    loop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.isRunning) {
            this.trafficLights.update(deltaTime);
            this.physics.update(deltaTime, this.graph);
            this.updateDashboard();
        }

        // Render continuously to ensure canvas stays responsive even when sim is paused
        this.renderer.draw();
        
        requestAnimationFrame((t) => this.loop(t));
    }

    updateDashboard() {
        document.getElementById('metric-vehicles').innerText = this.physics.vehicles.length;
        document.getElementById('metric-inflow').innerText = this.physics.getSystemInflow() + ' veh/min';
        document.getElementById('metric-outflow').innerText = this.physics.getSystemOutflow() + ' veh/min';
        
        let avgJourney = 0;
        if (this.physics.completedJourneys > 0) {
            avgJourney = (this.physics.totalJourneyTimesMs / this.physics.completedJourneys) / 1000;
        }
        document.getElementById('metric-journey').innerText = avgJourney.toFixed(1) + 's';
        
        document.getElementById('metric-bottleneck').innerText = this.physics.currentBottleneckName;
    }
}

// Initialize the engine when the DOM is ready (or script is loaded as module)
const engine = new Engine();
