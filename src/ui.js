import { groupEdgesIntoPhases } from './trafficLights.js';

export class UIManager {
    constructor(graph, renderer, mapManager) {
        this.graph = graph;
        this.renderer = renderer;
        this.mapManager = mapManager;

        // Modes: 'edit' or 'sim'
        this.mode = 'edit';
        this.editSubMode = 'select'; // 'select' or 'draw'
        
        // Edit mode state
        this.selectedNode = null; 
        this.selectedEdge = null; 
        this.drawingStartNode = null; // Used in 'draw' submode

        this.draggingNode = null;
        this.draggingControlPoint = null; 

        // DOM Elements
        this.btnEditMode = document.getElementById('btn-edit-mode');
        this.btnSimMode = document.getElementById('btn-sim-mode');
        this.editTools = document.getElementById('edit-tools');
        this.simTools = document.getElementById('sim-tools');
        
        // Edit Sub-modes
        this.btnToolSelect = document.getElementById('btn-tool-select');
        this.btnToolDraw = document.getElementById('btn-tool-draw');
        this.toolInstruction = document.getElementById('tool-instruction');

        // File Actions
        this.btnExport = document.getElementById('btn-export');
        this.btnImportTrigger = document.getElementById('btn-import-trigger');
        this.fileImport = document.getElementById('file-import');

        this.selectionDetails = document.getElementById('selection-details');
        
        // Node Properties
        this.nodeControls = document.getElementById('node-controls');
        this.inputNodeName = document.getElementById('node-name');
        this.inputNodeType = document.getElementById('node-type');
        this.nodeInflowContainer = document.getElementById('node-inflow-container');
        this.inputNodeInflowRate = document.getElementById('node-inflow-rate');
        this.nodePhasesContainer = document.getElementById('node-phases-container');
        this.btnUpdateNode = document.getElementById('btn-update-node');
        this.btnDeleteNode = document.getElementById('btn-delete-node');

        // Edge Properties
        this.edgeControls = document.getElementById('edge-controls');
        this.inputSpeedLimit = document.getElementById('speed-limit');
        this.inputEdgeDirection = document.getElementById('edge-direction');
        this.btnUpdateEdge = document.getElementById('btn-update-edge');
        this.btnDeleteEdge = document.getElementById('btn-delete-edge');

        // Readme Modal
        this.btnReadme = document.getElementById('btn-readme');
        this.readmeModal = document.getElementById('readme-modal');
        this.btnCloseModal = document.getElementById('btn-close-modal');
        this.readmeContent = document.getElementById('readme-content');

        this.initEventListeners();
        this.initMapEvents();
    }

    initEventListeners() {
        this.btnEditMode.addEventListener('click', () => this.setMode('edit'));
        this.btnSimMode.addEventListener('click', () => this.setMode('sim'));

        this.btnToolSelect.addEventListener('click', () => this.setEditSubMode('select'));
        this.btnToolDraw.addEventListener('click', () => this.setEditSubMode('draw'));

        // Save / Load
        this.btnExport.addEventListener('click', () => this.exportMap());
        this.btnImportTrigger.addEventListener('click', () => this.fileImport.click());
        this.fileImport.addEventListener('change', (e) => this.importMap(e));

        // Readme Modal
        this.btnReadme.addEventListener('click', () => this.openReadme());
        this.btnCloseModal.addEventListener('click', () => this.closeReadme());
        this.readmeModal.addEventListener('click', (e) => {
            if (e.target === this.readmeModal) {
                this.closeReadme();
            }
        });

        // Edge properties
        this.btnUpdateEdge.addEventListener('click', () => this.updateSelectedEdge());
        this.btnDeleteEdge.addEventListener('click', () => {
            if (this.selectedEdge) {
                // If it's a two way road, delete the paired edge too
                if (this.selectedEdge.pairedEdgeId) {
                    const paired = this.graph.edges.get(this.selectedEdge.pairedEdgeId);
                    if (paired) this.graph.removeEdge(paired);
                }
                this.graph.removeEdge(this.selectedEdge);
                this.clearSelection();
                this.renderer.draw();
            }
        });

        // Node properties
        this.inputNodeType.addEventListener('change', () => this.toggleNodePropertyFields());
        this.btnUpdateNode.addEventListener('click', () => this.updateSelectedNode());
        
        this.btnDeleteNode.addEventListener('click', () => {
            if (this.selectedNode) {
                this.graph.removeNode(this.selectedNode);
                this.clearSelection();
                this.renderer.draw();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.mode !== 'edit') return;
            
            if (e.key === 'Escape') {
                this.clearSelection();
                this.drawingStartNode = null;
                this.renderer.draw();
                return;
            }

            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedNode) {
                    this.graph.removeNode(this.selectedNode);
                    this.clearSelection();
                    this.renderer.draw();
                } else if (this.selectedEdge) {
                    if (this.selectedEdge.pairedEdgeId) {
                        const paired = this.graph.edges.get(this.selectedEdge.pairedEdgeId);
                        if (paired) this.graph.removeEdge(paired);
                    }
                    this.graph.removeEdge(this.selectedEdge);
                    this.clearSelection();
                    this.renderer.draw();
                }
            }
        });
    }

    initMapEvents() {
        const map = this.mapManager.map;
        
        map.on('mousedown', (e) => {
            if (this.mode !== 'edit') return;
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            if (this.editSubMode === 'select') {
                // Check if grabbing a node
                const clickedNode = this.renderer.findNodeAt(lat, lng);
                if (clickedNode) {
                    this.draggingNode = clickedNode;
                    map.dragging.disable();
                    return;
                }

                // Check if grabbing a control point
                const cp = this.renderer.findControlPointAt(lat, lng);
                if (cp) {
                    this.draggingControlPoint = cp;
                    map.dragging.disable();
                    return;
                }
            }
        });

        map.on('mousemove', (e) => {
            if (this.mode !== 'edit') return;
            
            if (this.draggingNode) {
                this.draggingNode.lat = e.latlng.lat;
                this.draggingNode.lng = e.latlng.lng;
                this.renderer.draw();
            } else if (this.draggingControlPoint) {
                const { edge, index } = this.draggingControlPoint;
                edge.controlPoints[index].lat = e.latlng.lat;
                edge.controlPoints[index].lng = e.latlng.lng;
                // Update paired edge control points in reverse
                if (edge.pairedEdgeId) {
                    const paired = this.graph.edges.get(edge.pairedEdgeId);
                    if (paired && paired.controlPoints.length === edge.controlPoints.length) {
                        const pairedIdx = paired.controlPoints.length - 1 - index;
                        paired.controlPoints[pairedIdx].lat = e.latlng.lat;
                        paired.controlPoints[pairedIdx].lng = e.latlng.lng;
                    }
                }
                this.renderer.draw();
            }
        });

        map.on('mouseup', () => {
            if (this.draggingNode || this.draggingControlPoint) {
                this.draggingNode = null;
                this.draggingControlPoint = null;
                map.dragging.enable();
            }
        });

        map.on('dblclick', (e) => {
            if (this.mode !== 'edit') return;
            L.DomEvent.stopPropagation(e);

            if (this.editSubMode === 'select' && this.selectedEdge) {
                const clickedEdge = this.renderer.findEdgeAt(e.latlng.lat, e.latlng.lng);
                if (clickedEdge === this.selectedEdge || clickedEdge?.pairedEdgeId === this.selectedEdge.id) {
                    const edgeToUpdate = this.selectedEdge;
                    const index = this.renderer.findBestControlPointInsertion(edgeToUpdate, e.latlng.lat, e.latlng.lng);
                    edgeToUpdate.controlPoints.splice(index, 0, { lat: e.latlng.lat, lng: e.latlng.lng });
                    
                    if (edgeToUpdate.pairedEdgeId) {
                        const paired = this.graph.edges.get(edgeToUpdate.pairedEdgeId);
                        if (paired) {
                            const pairedIdx = paired.controlPoints.length - index;
                            paired.controlPoints.splice(pairedIdx, 0, { lat: e.latlng.lat, lng: e.latlng.lng });
                        }
                    }
                    this.renderer.draw();
                }
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'edit') {
            this.btnEditMode.classList.add('active');
            this.btnSimMode.classList.remove('active');
            this.editTools.classList.remove('hidden');
            this.simTools.classList.add('hidden');
            this.mapManager.map.doubleClickZoom.disable();
        } else {
            this.btnSimMode.classList.add('active');
            this.btnEditMode.classList.remove('active');
            this.simTools.classList.remove('hidden');
            this.editTools.classList.add('hidden');
            this.clearSelection();
            this.mapManager.map.doubleClickZoom.enable();
        }
    }

    setEditSubMode(subMode) {
        this.editSubMode = subMode;
        if (subMode === 'select') {
            this.btnToolSelect.classList.add('active');
            this.btnToolDraw.classList.remove('active');
            this.toolInstruction.innerText = "Select nodes or roads to edit their properties.";
            this.drawingStartNode = null;
        } else {
            this.btnToolDraw.classList.add('active');
            this.btnToolSelect.classList.remove('active');
            this.toolInstruction.innerText = "Click to place nodes. Click two nodes consecutively to connect them.";
            this.clearSelection();
        }
    }

    handleMapClick(lat, lng) {
        if (this.mode !== 'edit') return;
        if (this.draggingNode || this.draggingControlPoint) return;

        const clickedNode = this.renderer.findNodeAt(lat, lng);

        if (this.editSubMode === 'select') {
            if (clickedNode) {
                this.selectNode(clickedNode);
            } else {
                const clickedEdge = this.renderer.findEdgeAt(lat, lng);
                if (clickedEdge) {
                    this.selectEdge(clickedEdge);
                } else {
                    this.clearSelection();
                }
            }
        } else if (this.editSubMode === 'draw') {
            if (clickedNode) {
                if (this.drawingStartNode && this.drawingStartNode !== clickedNode) {
                    // Create road
                    this.graph.addEdge(this.drawingStartNode, clickedNode);
                    this.drawingStartNode = clickedNode; 
                } else {
                    this.drawingStartNode = clickedNode;
                }
                // Visual feedback
                this.renderer.setSelection(this.drawingStartNode, null);
            } else {
                // Clicked empty space: Create a new node
                const newNode = this.graph.addNode(lat, lng);
                if (this.drawingStartNode) {
                    this.graph.addEdge(this.drawingStartNode, newNode);
                }
                this.drawingStartNode = newNode;
                this.renderer.setSelection(this.drawingStartNode, null);
            }
        }

        // The renderer uses selectedNode for highlighting. 
        if (this.editSubMode === 'select') {
            this.renderer.setSelection(this.selectedNode, this.selectedEdge);
        }
    }

    selectNode(node) {
        this.selectedNode = node;
        this.selectedEdge = null;
        this.updateSelectionUI(`Node selected: ${node.name || node.id}`);
        
        this.inputNodeName.value = node.name;
        this.inputNodeType.value = node.type;
        
        this.toggleNodePropertyFields();
        this.inputNodeInflowRate.value = node.inflowRate;

        this.nodeControls.classList.remove('hidden');
        this.edgeControls.classList.add('hidden');
    }

    toggleNodePropertyFields() {
        const type = this.inputNodeType.value;
        if (type === 'inflow_outflow') {
            this.nodeInflowContainer.classList.remove('hidden');
            this.nodePhasesContainer.classList.add('hidden');
        } else if (type === 'traffic_light') {
            this.nodeInflowContainer.classList.add('hidden');
            this.nodePhasesContainer.classList.remove('hidden');
            this.renderPhaseInputs();
        } else {
            this.nodeInflowContainer.classList.add('hidden');
            this.nodePhasesContainer.classList.add('hidden');
        }
    }

    renderPhaseInputs() {
        this.nodePhasesContainer.innerHTML = '';
        if (!this.selectedNode) return;
        
        const incomingEdges = [];
        for (const edge of this.graph.edges.values()) {
            if (edge.endNode === this.selectedNode) {
                incomingEdges.push(edge);
            }
        }
        const phaseObjects = groupEdgesIntoPhases(incomingEdges);
        
        for (let i = 0; i < phaseObjects.length; i++) {
            const phase = phaseObjects[i];
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            
            const labelText = `Phase ${i+1} (${phase.label}):`;
            
            div.innerHTML = `<label style="display:inline-block; width: 160px; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${phase.label}">${labelText}</label>
                             <input type="number" class="phase-input" data-index="${i}" value="${this.selectedNode.phaseTimings[i] || 15}" min="5" max="120" style="width: 50px;">`;
            
            div.addEventListener('mouseenter', () => {
                this.renderer.hoveredEdges = phase.edges;
                this.renderer.draw();
            });
            
            div.addEventListener('mouseleave', () => {
                this.renderer.hoveredEdges = null;
                this.renderer.draw();
            });

            this.nodePhasesContainer.appendChild(div);
        }
        if (phaseObjects.length === 0) {
            this.nodePhasesContainer.innerHTML = '<p style="color:#888; font-size: 0.9em;">Connect incoming roads to configure phases.</p>';
        }
    }

    updateSelectedNode() {
        if (this.selectedNode) {
            this.selectedNode.name = this.inputNodeName.value;
            this.selectedNode.type = this.inputNodeType.value;
            this.selectedNode.inflowRate = parseInt(this.inputNodeInflowRate.value, 10);
            
            if (this.selectedNode.type === 'traffic_light') {
                const inputs = this.nodePhasesContainer.querySelectorAll('.phase-input');
                inputs.forEach(input => {
                    const idx = parseInt(input.getAttribute('data-index'), 10);
                    this.selectedNode.phaseTimings[idx] = parseInt(input.value, 10);
                });
            }
            
            this.updateSelectionUI(`Node updated: ${this.selectedNode.name}`);
            this.renderer.draw();
        }
    }

    selectEdge(edge) {
        this.selectedEdge = edge;
        this.selectedNode = null;
        this.updateSelectionUI(`Edge selected: ${edge.id}`);
        
        this.inputSpeedLimit.value = edge.speedLimit;
        this.inputEdgeDirection.value = edge.pairedEdgeId ? 'two-way' : 'one-way';
        
        this.edgeControls.classList.remove('hidden');
        this.nodeControls.classList.add('hidden');
    }

    clearSelection() {
        this.selectedNode = null;
        this.selectedEdge = null;
        this.updateSelectionUI('None');
        this.edgeControls.classList.add('hidden');
        this.nodeControls.classList.add('hidden');
        this.renderer.setSelection(null, null);
    }

    updateSelectionUI(text) {
        this.selectionDetails.innerText = text;
    }

    updateSelectedEdge() {
        if (this.selectedEdge) {
            const newSpeed = parseInt(this.inputSpeedLimit.value, 10);
            this.selectedEdge.speedLimit = newSpeed;
            
            const dir = this.inputEdgeDirection.value;
            if (dir === 'two-way' && !this.selectedEdge.pairedEdgeId) {
                // Create reverse edge
                const rev = this.graph.addEdge(this.selectedEdge.endNode, this.selectedEdge.startNode, newSpeed);
                if (rev) {
                    // Copy control points in reverse
                    rev.controlPoints = [...this.selectedEdge.controlPoints].reverse();
                    this.selectedEdge.pairedEdgeId = rev.id;
                    rev.pairedEdgeId = this.selectedEdge.id;
                }
            } else if (dir === 'one-way' && this.selectedEdge.pairedEdgeId) {
                // Remove reverse edge
                const paired = this.graph.edges.get(this.selectedEdge.pairedEdgeId);
                if (paired) {
                    this.graph.removeEdge(paired);
                }
                this.selectedEdge.pairedEdgeId = null;
            }

            // Sync paired edge speed
            if (this.selectedEdge.pairedEdgeId) {
                const paired = this.graph.edges.get(this.selectedEdge.pairedEdgeId);
                if (paired) paired.speedLimit = newSpeed;
            }

            this.updateSelectionUI(`Edge ${this.selectedEdge.id} updated.`);
            this.renderer.draw();
        }
    }

    exportMap() {
        const json = this.graph.toJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'traffic_map.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    importMap(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const contents = e.target.result;
            try {
                this.graph.fromJSON(contents);
                this.clearSelection();
                this.renderer.draw();
                // Reset file input so the same file can be loaded again if needed
                this.fileImport.value = '';
            } catch (err) {
                alert("Failed to load map: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    openReadme() {
        this.readmeModal.classList.remove('hidden');
        fetch('./README.md')
            .then(res => res.text())
            .then(text => {
                let html = text
                    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                    .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>')
                    .replace(/<\/ul>\r?\n<ul>/gim, '')
                    .replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
                    .replace(/<\/ol>\r?\n<ol>/gim, '')
                    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                    .replace(/`(.*?)`/gim, '<code style="background:#333;padding:2px 4px;border-radius:3px;color:#eee;">$1</code>')
                    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>')
                    .replace(/^---/gim, '<hr>')
                    .replace(/\n\n/gim, '<p></p>');
                this.readmeContent.innerHTML = html;
            })
            .catch(err => {
                this.readmeContent.innerHTML = '<p>Error loading README.md</p>';
            });
    }

    closeReadme() {
        this.readmeModal.classList.add('hidden');
    }
}
