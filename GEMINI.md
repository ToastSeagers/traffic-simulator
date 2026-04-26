# Traffic Simulator Project Guidelines

## Role
You are an expert Simulation Engineer and Front-End Developer. Your goal is to build a high-performance, web-based traffic simulator.

## Tech Stack
- Vanilla JavaScript (ES6+ Modules)
- HTML5 Canvas API (for high-performance 2D rendering)
- Leaflet.js (for OpenStreetMap tile integration)
- CSS3 (Clean, modern, responsive UI)
- No heavy frameworks (e.g., React, Angular) unless explicitly requested, to keep the physics loop unencumbered.

## Code Architecture & Rules
1. **Separation of Concerns:** Strictly separate logic.
   - `engine.js`: The central simulation loop (requestAnimationFrame).
   - `physics.js`: Kinematics, Intelligent Driver Model (IDM) calculations, and collision detection.
   - `renderer.js`: HTML5 Canvas drawing instructions only.
   - `map.js`: Leaflet map initialisation and coordinate translation.
   - `ui.js`: DOM manipulation and event listeners for the control panels.
2. **Performance:** The simulation loop must run independently of the frame rate. Pre-calculate complex math where possible. Do not instantiate new objects inside the rendering loop (use object pooling for vehicles if the count exceeds 1000).
3. **Data Structures:** Represent the road network as a Directed Graph. Nodes are intersections; Edges are road segments.

## Language & Formatting
- Always use South African/British English spelling in both code comments and UI copy (e.g., synchronise, colour, behaviour, centre).
- Use metric units exclusively (km/h for speed, metres for distance).
- Keep functions small and modular. Add clear JSDoc comments explaining the inputs and outputs of complex physics equations.

## Project Context
This tool is intended to test infrastructure changes and present data-backed proposals. For instance, testing flow rates, visualising congestion patterns around local intersections (like those near Murray Road), and optimising light synchronisation to improve throughput. Accuracy in the vehicle reaction delay is paramount for realistic queue clearance times.

---

## Current Project Status

### What Has Been Achieved
- **Core Architecture:** The ES6 module skeleton is fully established (`engine.js`, `graph.js`, `map.js`, `physics.js`, `renderer.js`, `ui.js`, `trafficLights.js`).
- **Map & Canvas Integration:** Leaflet.js is integrated for OpenStreetMap base layers. HTML5 Canvas is overlaid on top, perfectly synchronising lat/lng graph coordinates to screen space during panning and zooming.
- **Graph Network Editor:** A fully functional "Edit Mode" allows users to visually draw and modify the road network. Features include adding nodes (intersections), connecting edges (roads), adjusting curve control points, and setting roads as one-way or two-way.
- **Node & Edge Configuration:** Users can set speed limits on roads and configure node types (e.g., `inflow_outflow` or `traffic_light`).
- **Dynamic Traffic Lights:** Implemented an intelligent system that groups incoming intersection roads into opposing phases based on cardinal direction geometry (using `Math.atan2`). The UI dynamically presents the correct number of phase timing inputs and provides canvas highlight feedback when hovering over them.
- **Serialization:** The entire graph can be exported to and imported from JSON, allowing users to save and load road network configurations.
- **Simulation Loop:** The `requestAnimationFrame` loop is separated from physics updates, and dashboard metrics (active vehicles, real-time system inflow/outflow, average journey time, bottlenecks) are wired up to the DOM.

### How It Was Achieved
- **Vanilla JavaScript & Canvas:** Adhered to the tech stack restrictions, avoiding heavy frameworks to ensure the simulation loop remains extremely performant.
- **Custom Event Handling:** Handled complex UI state switching between Edit and Sim modes. Map dragging and zooming are carefully disabled or intercepted when users are actively moving nodes or drawing roads.
- **Modular Data Structures:** Built a robust `Graph`, `Node`, and `Edge` class system that cleanly separates physical attributes (like lat/lng and speed limits) from visual rendering.

### What Still Needs To Be Done
- **Vehicle Physics (IDM):** Fully flesh out the `PhysicsEngine` using the Intelligent Driver Model (IDM) for realistic acceleration, deceleration, and following distances.
- **Intersection Logic & Yielding:** Vehicles must respect the dynamic traffic light states (stopping at red/amber, accelerating on green). Implement right-of-way yielding for stop signs and unprotected turns.
- **Pathfinding / Routing:** Implement a routing algorithm (like Dijkstra's or A*) so that vehicles spawned at an `inflow` node can navigate the directed graph towards an `outflow` destination.
- **Object Pooling:** Implement a vehicle object pool to reuse memory and avoid garbage collection stutters when the simulation scales to thousands of vehicles.
- **Lane Mechanics:** Extend the edge model to support multiple lanes, lane-changing logic, and turn-specific lanes at intersections.
- **Advanced Metrics:** Improve the collection of traffic flow data to accurately identify bottlenecks, measure queue clearance times at intersections, and track lane-specific density.