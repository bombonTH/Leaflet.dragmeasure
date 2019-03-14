function bind(fn, obj) {
    var slice = Array.prototype.slice;

    if (fn.bind) {
        return fn.bind.apply(fn, slice.call(arguments, 1));
    }

    var args = slice.call(arguments, 2);

    return function () {
        return fn.apply(obj,
            args.length ? args.concat(slice.call(arguments)) : arguments);
    };
}

L.CRS.Earth.bearing = function (latlng1, latlng2) {
    let rad = Math.PI / 180,
        lat1 = latlng1.lat * rad,
        lat2 = latlng2.lat * rad,
        deltaLng = (latlng2.lng - latlng1.lng) * rad;
    let y = Math.sin(deltaLng) * Math.cos(lat2),
        x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return ((Math.atan2(y, x) / rad) + 360) % 360;
};

L.LatLng.prototype.bearingTo = function (other) {
    return L.CRS.Earth.bearing(this, L.latLng(other));
};

let DragMeasure = L.Handler.extend({
    initialize: function (map) {
        this._map = map;
        this._container = map._container;
        this._pane = map._overlayPane;
        this.resetStateTimeout = 0;
        map.on('unload', this._destroy, this);
    },

    addHooks: function () {
        L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
    },

    removeHooks: function () {
        L.DomEvent.off(this._container, 'mousedown', this._onMouseDown, this);
    },

    moved: function () {
        return this._moved;
    },

    _destroy: function () {
        remove(this._pane);
        delete this._pane;
    },

    _resetState: function () {
        this._resetStateTimeout = 0
        this._moved = false;
    },

    _clearDeferredResetState: function () {
        if (this._resetStateTimeout !== 0) {
            clearTimeout(this._resetStateTimeout);
            this._resetStateTimeout = 0;
        }
    },

    _onMouseDown: function (e) {
        if (!e.ctrlKey || ((e.which !== 1) && (e.button !== 1))) {
            return false;
        }

        this._clearDeferredResetState();
        this._resetState();

        L.DomUtil.disableTextSelection();
        L.DomUtil.disableImageDrag();
        this._map.dragging.disable();
        this._map._container.style.cursor = "crosshair";

        this._startPoint = this._map.mouseEventToLatLng(e);
        this._startMarker = L.circleMarker(this._startPoint, {
            color: 'red',
            radius: 2,
            pane: 'tooltipPane',
            interactive: false
        }).addTo(this._map);
        L.DomEvent.on(document, {
            contextmenu: stop,
            mousemove: this._onMouseMove,
            mouseup: this._onMouseUp,
            keydown: this._onKeyDown
        }, this);

    },

    _onMouseMove: function (e) {
        if (!this._moved) {
            this._moved = true;
        }
        if (this._line) {
            this._map.removeLayer(this._line);
            this._map.removeLayer(this._currentMarker);
            this._line = null;
        }

        this._currentPoint = this._map.mouseEventToLatLng(e);
        this._distance = (this._startPoint.distanceTo(this._currentPoint) / 1852).toFixed(2);
        this._bearing = this._startPoint.bearingTo(this._currentPoint).toFixed(0);
        let text = `Bearing: ${this._bearing} <br>Distance: ${this._distance} NM`;
        this._line = L.polyline([this._startPoint, this._currentPoint], {
            color: 'red',
            dashArray: '1,6',
            className: 'leaflet-crosshair',
            pane: 'tooltipPane',
            interactive: false
        });
        this._currentMarker = L.circleMarker(this._currentPoint, {
            color: 'red',
            radius: 2,
            className: 'leaflet-crosshair',
            pane: 'tooltipPane',
            interactive: false
        }).addTo(this._map).bindTooltip(text, {
            permanent: true
        }).openTooltip();
        this._line.addTo(this._map);
    },

    _finish: function () {
        if (this._moved) {
            this._map.removeLayer(this._line);
            this._map.removeLayer(this._startMarker);
            this._map.removeLayer(this._currentMarker);
            this._line = null;
            this._startMarker = null;
            this._currentMarker = null;
        }

        L.DomUtil.enableTextSelection();
        L.DomUtil.enableImageDrag();

        L.DomEvent.off(document, {
            contextmenu: stop,
            mousemove: this._onMouseMove,
            mouseup: this._onMouseUp,
            keydown: this._onKeyDown
        }, this);

        this._map.dragging.enable();
        this._map._container.style.cursor = "";
    },

    _onMouseUp: function (e) {
        if ((e.which !== 1) && (e.button !== 1)) {
            return;
        }

        this._finish();

        if (!this._moved) {
            return;
        }

        this._clearDeferredResetState();
        this.resetStateTimeout = setTimeout(bind(this._resetState, this), 0);
    },

    _onKeyDown: function (e) {
        if (e.keyCode === 27) {
            this._finish();
        }
    }

});

L.Map.mergeOptions({
    dragMeasure: true
});

L.Map.addInitHook(function () {
    if (this.options.dragMeasure) {
        this.addHandler('dragMeasure', DragMeasure);
    }
});
