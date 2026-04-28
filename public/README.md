# Traffic Simulator

Welcome to the high-performance, web-based Traffic Simulator. This tool is designed to help you visually construct road networks, configure intersections, and simulate traffic flows to test infrastructure changes and identify bottlenecks.

## Getting Started

### How to Run the Project
The project is built using Vanilla JavaScript and HTML5 Canvas, so it doesn't require any heavy build steps or server-side rendering.
1. You can run the project using any local web server. If you have Node.js installed, you can use a package like `serve` or `http-server` from the root directory.
2. Alternatively, if you're using an IDE like VS Code, simply use the "Live Server" extension on `index.html`.
3. Open the provided local URL in a modern web browser.

---

## Operating Modes

The application operates in two distinct modes, toggled via the buttons on the left-hand control panel:
- **Edit Mode:** Used for constructing and modifying your road network.
- **Simulation Mode:** Used to run the traffic simulation and view metrics.

---

## Building the Road Network (Edit Mode)

In **Edit Mode**, you interact directly with the map to draw your network.

### Adding Intersections (Nodes)
1. Select **Draw Road** from the Edit Tools panel.
2. Click anywhere on the map to place a new Node. This acts as an intersection or an endpoint.

### Connecting Roads (Edges)
1. While in the **Draw Road** tool, click on an existing Node to start drawing a road.
2. Click on a second Node to connect them. This creates a directed road segment (Edge) between the two nodes.
3. *Note: By default, drawing a road creates a one-way street. You can change this to two-way in the selection properties.*

### Shaping Roads (Curves)
1. Switch to the **Select** tool.
2. Click on a road to select it. You will see blue "Control Points" appear along the road.
3. Double-click anywhere on the selected road to add a new Control Point.
4. Click and drag the blue Control Points to bend and shape the road around obstacles or natural curves on the map.

### Modifying Properties
Using the **Select** tool, you can click on Nodes or Roads to modify their properties in the left-hand panel.

**Road (Edge) Properties:**
- **Speed Limit:** Set the maximum speed limit (in km/h).
- **Direction:** Toggle between **One-Way** and **Two-Way**. Setting it to two-way will automatically create a reverse road mirroring your curve control points.

**Intersection (Node) Properties:**
- **Type:** Change the node type.
  - *None:* A basic pass-through point.
  - *Spawn/Exit Point (Inflow/Outflow):* Sets this node as an entry/exit point for vehicles. You can configure the **Inflow Rate (veh/min)**.
  - *Traffic Light:* Converts the intersection into a controlled traffic light junction.
  - *4-Way Stop:* Vehicles will treat this intersection as a stop sign.

---

## Configuring Traffic Lights

When you set a Node's type to **Traffic Light**, the simulator intelligently analyses all incoming roads and groups them into opposing directional phases (e.g., North/South as one phase, East/West as another).

1. Select the intersection using the **Select** tool.
2. Ensure the type is set to **Traffic Light**.
3. A list of dynamically generated **Phases** will appear in the panel. Hovering over a phase input will highlight the corresponding incoming roads on the map.
4. Adjust the green-light duration (in seconds) for each phase. 
5. Click **Update Node** to save your changes.

*Visual Indicator:* In simulation mode, the intersection node will display coloured wedges pointing towards each incoming road, indicating whether that specific approach currently has a green, amber, or red light.

---

## Running the Simulation

Once your network is built, click **Simulation Mode** in the top-left panel.

### Controls
- **Start:** Begins the vehicle simulation and activates the traffic light cycles.
- **Pause:** Pauses the simulation while preserving the current state.
- **Reset:** Clears all vehicles from the network and resets the traffic light cycles, allowing you to start fresh.

### Dashboard Metrics
While the simulation is running, the dashboard provides live data:
- **Active Vehicles:** The total number of vehicles currently navigating the network.
- **System Inflow:** Real-time throughput showing vehicles successfully entering the network per minute.
- **System Outflow:** Real-time throughput showing vehicles successfully reaching their destination per minute.
- **Avg Journey:** The average time it takes for a vehicle to complete its route from a spawn point to an exit point.
- **Bottleneck:** Identifies the intersection causing the most delay, helping you target infrastructure improvements.

---

## Saving and Loading

You do not need to rebuild your network every time!
- **Export Map:** Downloads your current road network (including nodes, road curves, speed limits, and traffic light timings) as a `traffic_map.json` file.
- **Import Map:** Loads a previously exported `.json` file, instantly restoring your network configuration.

---

## Project Info

- **Version:** 0.5
- **Last Updated:** 28 April 2026
- **Author:** Toast Seagers
- **Project Page:** [seagers.co.za/projects/traffic-simulator](https://seagers.co.za/projects/traffic-simulator/)
- **Source Code:** [github.com/ToastSeagers/traffic-simulator](https://github.com/ToastSeagers/traffic-simulator)

Have ideas, suggestions, or feedback? I'd love to hear from you! Visit the [project page](https://seagers.co.za/projects/traffic-simulator/) to get in touch.

---

&copy; 2026 Toast Seagers
