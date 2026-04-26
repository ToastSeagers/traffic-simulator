/**
 * Map Module handles the Leaflet map initialization, events,
 * and translation between geographical coordinates and canvas pixels.
 */

// Initial coordinates for Kenilworth area around Murray Road
const INITIAL_LAT = -33.9958;
const INITIAL_LNG = 18.4750;
const INITIAL_ZOOM = 16;

export class MapManager {
    constructor(containerId) {
        this.map = L.map(containerId, {
            zoomControl: false // Disable default zoom control if we want a cleaner UI, or keep it.
        }).setView([INITIAL_LAT, INITIAL_LNG], INITIAL_ZOOM);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        // State callbacks
        this.onMapClickCallback = null;
        this.onMapChangeCallback = null;

        // Listen for map clicks
        this.map.on('click', (e) => {
            if (this.onMapClickCallback) {
                this.onMapClickCallback(e.latlng.lat, e.latlng.lng);
            }
        });

        // Listen for map movement or zoom to trigger canvas redraws
        this.map.on('move', () => {
            if (this.onMapChangeCallback) {
                this.onMapChangeCallback();
            }
        });
        this.map.on('zoom', () => {
            if (this.onMapChangeCallback) {
                this.onMapChangeCallback();
            }
        });
    }

    /**
     * Converts Latitude and Longitude to X and Y pixel coordinates on the canvas.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {{x: number, y: number}}
     */
    latLngToPixel(lat, lng) {
        const point = this.map.latLngToContainerPoint([lat, lng]);
        return { x: point.x, y: point.y };
    }

    /**
     * Converts a specific pixel coordinate back to lat/lng.
     * @param {number} x 
     * @param {number} y 
     * @returns {{lat: number, lng: number}}
     */
    pixelToLatLng(x, y) {
        const latlng = this.map.containerPointToLatLng([x, y]);
        return { lat: latlng.lat, lng: latlng.lng };
    }

    onMapClick(callback) {
        this.onMapClickCallback = callback;
    }

    onMapChange(callback) {
        this.onMapChangeCallback = callback;
    }
}
