import application = require("tns-core-modules/application");

import common = require("./map-view-common");

import {
    MapViewBase, BoundsBase, CircleBase, 
    MarkerBase, PolygonBase, PolylineBase, 
    PositionBase, ShapeBase, latitudeProperty,
    longitudeProperty, bearingProperty, zoomProperty,
    tiltProperty 
} from "./map-view-common";
import { Image } from "tns-core-modules/ui/image";
import { Color } from "tns-core-modules/color";
import imageSource = require("tns-core-modules/image-source");

declare const com: any;

export class MapView extends MapViewBase {

    protected _markers: Array<Marker> = new Array<Marker>();
    private _context: any;
    private _pendingCameraUpdate: boolean;

    onLoaded() {
        super.onLoaded();

        application.android.on(application.AndroidApplication.activityPausedEvent, this.onActivityPaused, this);
        application.android.on(application.AndroidApplication.activityResumedEvent, this.onActivityResumed, this);
        application.android.on(application.AndroidApplication.saveActivityStateEvent, this.onActivitySaveInstanceState, this);
        application.android.on(application.AndroidApplication.activityDestroyedEvent, this.onActivityDestroyed, this);
    }

    onUnloaded() {
        super.onUnloaded();

        application.android.off(application.AndroidApplication.activityPausedEvent, this.onActivityPaused, this);
        application.android.off(application.AndroidApplication.activityResumedEvent, this.onActivityResumed, this);
        application.android.off(application.AndroidApplication.saveActivityStateEvent, this.onActivitySaveInstanceState, this);
        application.android.off(application.AndroidApplication.activityDestroyedEvent, this.onActivityDestroyed, this);
    }

    private _createCameraPosition() {
        var cpBuilder = new com.google.android.gms.maps.model.CameraPosition.Builder();
        var update = false;

        if (!isNaN(this.latitude) && !isNaN(this.longitude)) {
            update = true;
            cpBuilder.target(new com.google.android.gms.maps.model.LatLng(this.latitude, this.longitude));
        }

        if (!isNaN(this.bearing)) {
            update = true;
            cpBuilder.bearing(this.bearing);
        }

        if (!isNaN(this.zoom)) {
            update = true;
            cpBuilder.zoom(this.zoom);
        }

        if (!isNaN(this.tilt)) {
            update = true;
            cpBuilder.tilt(this.tilt);
        }

        return (update) ? cpBuilder.build() : null;
    }

    updateCamera() {
        var cameraPosition = this._createCameraPosition();
        if (!cameraPosition) return;

        if (!this.gMap) {
            this._pendingCameraUpdate = true;
            return;
        }

        this._pendingCameraUpdate = false;

        var cameraUpdate = com.google.android.gms.maps.CameraUpdateFactory.newCameraPosition(cameraPosition);
        this.gMap.moveCamera(cameraUpdate);
    }

    setViewport(bounds:Bounds, padding?:number) {
        var p = padding || 0;
        var cameraUpdate = com.google.android.gms.maps.CameraUpdateFactory.newLatLngBounds(bounds.android, p);
        if (!this.gMap) {
            this._pendingCameraUpdate = true
            return;
        }

        this._pendingCameraUpdate = false;
        this.gMap.moveCamera(cameraUpdate);
    }

    updatePadding() {
        if (this.padding && this.gMap) {
            this.gMap.setPadding(
                this.padding[2] || 0,
                this.padding[0] || 0,
                this.padding[3] || 0,
                this.padding[1] || 0
            );
        }
    }

    get android(): never {
        throw new Error('Now use instance.nativeView instead of instance.android');
    }

    get gMap() {
        return this._gMap;
    }

    addMarker(marker: Marker) {
        marker.android = this.gMap.addMarker(marker.android);
        this._markers.push(marker);
    }

    removeMarker(marker: Marker) {
        marker.android.remove();
        this._markers.splice(this._markers.indexOf(marker), 1);
    }

    removeAllMarkers() {
        this._markers.forEach(marker => {
            marker.android.remove();
        });
        this._markers = [];
    }

    findMarker(callback: (marker: Marker) => boolean): Marker {
        return this._markers.find(callback);
    }

    addPolyline(shape: Polyline) {
        shape.loadPoints();
        shape.android = this.gMap.addPolyline(shape.android);
        this._shapes.push(shape);
    }

    addPolygon(shape: Polygon) {
        shape.loadPoints();
        shape.android = this.gMap.addPolygon(shape.android);
        this._shapes.push(shape);
    }

    addCircle(shape: Circle) {
        shape.android = this.gMap.addCircle(shape.android);
        this._shapes.push(shape);
    }

    removeShape(shape: ShapeBase) {
        shape.android.remove();
        this._shapes.splice(this._shapes.indexOf(shape), 1);
    }

    removeAllShapes() {
        this._shapes.forEach(shape => {
            shape.android.remove();
        });
        this._shapes = [];
    }

    clear() {
        this._markers = [];
        this._shapes = [];
        this.gMap.clear();
    }

    setStyle(style: Style): void {
        let styleOptions = new com.google.android.gms.maps.model.MapStyleOptions(JSON.stringify(style));
        return this.gMap.setMapStyle(styleOptions);
    }

    findShape(callback: (shape: ShapeBase) => boolean): ShapeBase {
        return this._shapes.find(callback);
    }

    private onActivityPaused(args) {
        if (!this.nativeView || this._context != args.activity) return;
        this.nativeView.onPause();
    }

    private onActivityResumed(args) {
        if (!this.nativeView || this._context != args.activity) return;
        this.nativeView.onResume();
    }

    private onActivitySaveInstanceState(args) {
        if (!this.nativeView || this._context != args.activity) return;
        this.nativeView.onSaveInstanceState(args.bundle);
    }

    private onActivityDestroyed(args) {
        if (!this.nativeView || this._context != args.activity) return;
        this.nativeView.onDestroy();
    }

    private createNativeView() {
        var cameraPosition = this._createCameraPosition();

        var options = new com.google.android.gms.maps.GoogleMapOptions();
        if (cameraPosition) options = options.camera(cameraPosition);

        return new com.google.android.gms.maps.MapView(this._context, options);
    }

    private initNativeView() {
        var that = new WeakRef(this);

        this.nativeView = this.createNativeView();

        this.nativeView.onCreate(null);
        this.nativeView.onResume();

        var mapReadyCallback = new com.google.android.gms.maps.OnMapReadyCallback({
            onMapReady: (gMap) => {
                var owner = that.get();
                owner._gMap = gMap;
                owner.updatePadding();
                if (owner._pendingCameraUpdate) {
                    owner.updateCamera();
                }

                gMap.setOnMapClickListener(new com.google.android.gms.maps.GoogleMap.OnMapClickListener({
                    onMapClick: (gmsPoint) => {

                        let position: Position = new Position(gmsPoint);
                        owner.notifyPositionEvent(MapViewBase.coordinateTappedEvent, position);
                    }
                }));

                gMap.setOnMapLongClickListener(new com.google.android.gms.maps.GoogleMap.OnMapLongClickListener({
                    onMapLongClick: (gmsPoint) => {
                        let position: Position = new Position(gmsPoint);
                        owner.notifyPositionEvent(MapViewBase.coordinateLongPressEvent, position);
                    }
                }));

                gMap.setOnMarkerClickListener(new com.google.android.gms.maps.GoogleMap.OnMarkerClickListener({
                    onMarkerClick: (gmsMarker) => {
                        let marker: Marker = owner.findMarker((marker: Marker) => marker.android.getId() === gmsMarker.getId());
                        owner.notifyMarkerTapped(marker);

                        return false;
                    }
                }));

                gMap.setOnInfoWindowClickListener(new com.google.android.gms.maps.GoogleMap.OnInfoWindowClickListener({
                    onInfoWindowClick: (gmsMarker) => {
                        let marker = owner.findMarker((marker: Marker) => marker.android.getId() === gmsMarker.getId());
                        owner.notifyMarkerInfoWindowTapped(marker);

                        return false;
                    }
                }));

                gMap.setOnCircleClickListener(new com.google.android.gms.maps.GoogleMap.OnCircleClickListener({
                    onCircleClick: (gmsCircle) => {
                        let shape: ShapeBase = owner.findShape((shape: ShapeBase) => shape.android.getId() === gmsCircle.getId());
                        if (shape) {
                            owner.notifyShapeTapped(shape);
                        }
                        return false;
                    }
                }));

                gMap.setOnPolylineClickListener(new com.google.android.gms.maps.GoogleMap.OnPolylineClickListener({
                    onPolylineClick: (gmsPolyline) => {
                        let shape: ShapeBase = owner.findShape((shape: ShapeBase) => shape.android.getId() === gmsPolyline.getId());
                        if (shape) {
                            owner.notifyShapeTapped(shape);
                        }
                        return false;
                    }
                }));

                gMap.setOnPolygonClickListener(new com.google.android.gms.maps.GoogleMap.OnPolygonClickListener({
                    onPolygonClick: (gmsPolygon) => {
                        let shape: ShapeBase = owner.findShape((shape: ShapeBase) => shape.android.getId() === gmsPolygon.getId());
                        if (shape) {
                            owner.notifyShapeTapped(shape);
                        }
                        return false;
                    }
                }));

                gMap.setOnMarkerDragListener(new com.google.android.gms.maps.GoogleMap.OnMarkerDragListener({
                    onMarkerDrag: (gmsMarker) => {
                        let marker: Marker = owner.findMarker((marker: Marker) => marker.android.getId() === gmsMarker.getId());
                        owner.notifyMarkerDrag(marker);
                    },
                    onMarkerDragEnd: (gmsMarker) => {
                        let marker: Marker = owner.findMarker((marker: Marker) => marker.android.getId() === gmsMarker.getId());
                        owner.notifyMarkerEndDragging(marker);
                    },
                    onMarkerDragStart: (gmsMarker) => {
                        let marker: Marker = owner.findMarker((marker: Marker) => marker.android.getId() === gmsMarker.getId());
                        owner.notifyMarkerBeginDragging(marker);
                    }
                }));

                gMap.setOnCameraChangeListener(new com.google.android.gms.maps.GoogleMap.OnCameraChangeListener({
                    onCameraChange: (cameraPosition) => {

                        owner._processingCameraEvent = true;

                        let cameraChanged: boolean = false;
                        if (owner.latitude != cameraPosition.target.latitude) {
                            cameraChanged = true;
                            latitudeProperty.nativeValueChange(owner, cameraPosition.target.latitude);
                        }
                        if (owner.longitude != cameraPosition.target.longitude) {
                            cameraChanged = true;
                            longitudeProperty.nativeValueChange(owner, cameraPosition.target.longitude);
                        }
                        if (owner.bearing != cameraPosition.bearing) {
                            cameraChanged = true;
                            bearingProperty.nativeValueChange(owner, cameraPosition.target.bearing);
                        }
                        if (owner.zoom != cameraPosition.zoom) {
                            cameraChanged = true;
                            zoomProperty.nativeValueChange(owner, cameraPosition.target.zoom);
                        }
                        if (owner.tilt != cameraPosition.tilt) {
                            cameraChanged = true;
                            tiltProperty.nativeValueChange(owner, cameraPosition.target.tilt);
                        }

                        if (cameraChanged) {
                            owner.notifyCameraEvent(MapViewBase.cameraChangedEvent, {
                                latitude: cameraPosition.target.latitude,
                                longitude: cameraPosition.target.longitude,
                                zoom: cameraPosition.zoom,
                                bearing: cameraPosition.bearing,
                                tilt: cameraPosition.tilt
                            });
                        }

                        owner._processingCameraEvent = false;

                    }
                }));

                owner.notifyMapReady();
            }
        });

        this.nativeView.getMapAsync(mapReadyCallback);
    }

}

export class Position extends PositionBase {

    private _android: any;

    get android() {
        return this._android;
    }

    get latitude() {
        return this._android.latitude;
    }

    set latitude(latitude: number) {
        this._android = new com.google.android.gms.maps.model.LatLng(parseFloat(""+latitude), this.longitude);
    }

    get longitude() {
        return this._android.longitude;
    }

    set longitude(longitude: number) {
        this._android = new com.google.android.gms.maps.model.LatLng(this.latitude, parseFloat(""+longitude));
    }

    constructor(android?: com.google.android.gms.maps.model.LatLng) {
        super();
        this._android = android || new com.google.android.gms.maps.model.LatLng(0, 0);
    }

    public static positionFromLatLng(latitude: number, longitude: number): Position {
        let position: Position = new Position();
        position.latitude = latitude;
        position.longitude = longitude;
        return position;
    }
}

export class Bounds extends BoundsBase {
    private _android: any;
    private _north: Position;
    private _south: Position;

    get android() {
        return this._android;
    }

    get southwest() {
        return this._south;
    }

    set southwest(southwest: Position) {
        this._south = southwest.android;
        if(this.northeast) {
            this._android = new com.google.android.gms.maps.model.LatLngBounds(this.southwest, this.northeast);
        }
    }

    get northeast() {
        return this._north;
    }

    set northeast(northeast: Position) {
        this._north = northeast.android;
        if(this.southwest) {
            this._android = new com.google.android.gms.maps.model.LatLngBounds(this.southwest, this.northeast);
        }
    }

    constructor() {
        super();
        // this._android = android || new com.google.android.gms.maps.model.LatLng(0, 0);
    }
}

export class Marker extends MarkerBase {
    private _android: any;
    private _icon: Image;
    private _isMarker: boolean = false;

    static CLASS = 'com.google.android.gms.maps.model.Marker';

    constructor() {
        super();
        this.android = new com.google.android.gms.maps.model.MarkerOptions();
    }


    get position() {
        return new Position(this._android.getPosition());
    }

    set position(value: Position) {
        if (this._isMarker) {
            this._android.setPosition(value.android);
        } else {
            this._android.position(value.android);
        }
    }

    get rotation() {
        return this._android.getRotation();
    }

    set rotation(value: number) {
        if (this._isMarker) {
            this._android.setRotation(value);
        } else {
            this._android.rotation(value);
        }
    }

    get zIndex() {
        return this._android.getZIndex();
    }

    set zIndex(value: number) {
        if (this._isMarker) {
            this._android.setZIndex(value);
        } else {
            this._android.zIndex(value);
        }
    }

    get title() {
        return this._android.getTitle();
    }

    set title(title: string) {
        if (this._isMarker) {
            this._android.setTitle(title);
        } else {
            this._android.title(title);
        }
    }

    get snippet() {
        return this._android.getSnippet();
    }

    set snippet(snippet: string) {
        if (this._isMarker) {
            this._android.setSnippet(snippet);
        } else {
            this._android.snippet(snippet);
        }
    }

    showInfoWindow(): void {
        if (this._isMarker) {
            this.android.showInfoWindow();
        }
    }

    get icon() {
        return this._icon;
    }

    set icon(value: Image) {
        if (typeof value === 'string') {
            var tempIcon = new Image();
            tempIcon.imageSource = imageSource.fromResource(String(value));
            value = tempIcon;
        }
        this._icon = value;
        var androidIcon = com.google.android.gms.maps.model.BitmapDescriptorFactory.fromBitmap(value.imageSource.android);
        if (this._isMarker) {
            this._android.setIcon(androidIcon);
        } else {
            this._android.icon(androidIcon);
        }
    }

    get alpha() {
        return this._android.getAlpha();
    }

    set alpha(value: number) {
        if (this._isMarker) {
            this._android.setAlpha(value);
        } else {
            this._android.alpha(value);
        }
    }

    get flat() {
        return this._android.isFlat();
    }

    set flat(value: boolean) {
        if (this._isMarker) {
            this._android.setFlat(value);
        } else {
            this._android.flat(value);
        }
    }

    get anchor() {
        return [this._android.getAnchorU(), this._android.getAnchorV()];
    }

    set anchor(value: Array<number>) {
        if (this._isMarker) {
            this._android.setAnchor(value[0], value[1]);
        } else {
            this._android.anchor(value[0], value[1]);
        }
    }

    get draggable() {
        return this._android.isDraggable();
    }

    set draggable(value: boolean) {
        if (this._isMarker) {
            this._android.setDraggable(value);
        } else {
            this._android.draggable(value);
        }
    }

    get visible() {
        return this._android.isVisible();
    }

    set visible(value: boolean) {
        if (this._isMarker) {
            this._android.setVisible(value);
        } else {
            this._android.visible(value);
        }
    }

    get android() {
        return this._android;
    }

    set android(android) {
        this._android = android;
        this._isMarker = android.getClass().getName() === Marker.CLASS;
    }
}


export class Polyline extends PolylineBase {
    private _android: any;
    private _color: Color;
    private _isReal: boolean = false;

    static CLASS = 'com.google.android.gms.maps.model.Polyline';

    constructor() {
        super();
        this.android = new com.google.android.gms.maps.model.PolylineOptions();
        this._points = new Array<Position>();
    }

    get clickable() {
        return this._android.isClickable();
    }

    set clickable(value: boolean) {
        if (this._isReal) {
            this._android.setClickable(value);
        } else {
            this._android.clickable(value);
        }
    }

    get zIndex() {
        return this._android.getZIndex();
    }

    set zIndex(value: number) {
        if (this._isReal) {
            this._android.setZIndex(value);
        } else {
            this._android.zIndex(value);
        }
    }

    get visible() {
        return this._android.isVisible();
    }

    set visible(value: boolean) {
        if (this._isReal) {
            this._android.setVisible(value);
        } else {
            this._android.visible(value);
        }
    }

    loadPoints(): void {
        if (!this._isReal) {
            this._points.forEach((point: Position) => {
                this._android.add(point.android);
            });
        }
    }

    reloadPoints(): void {
        if (this._isReal) {
            var points = new java.util.ArrayList();
            this._points.forEach((point: Position) => {
                points.add(point.android);
            });
            this._android.setPoints(points);
        }
    }

    get width() {
        return this._android.getStrokeWidth();
    }

    set width(value: number) {
        if (this._isReal) {
            this._android.setWidth(value);
        } else {
            this._android.width(value);
        }
    }

    get color() {
        return this._color;
    }

    set color(value: Color) {
        this._color = value;
        if (this._isReal) {
            this._android.setStrokeColor(value.android);
        } else {
            this._android.color(value.android);
        }
    }

    get geodesic() {
        return this._android.isGeodesic();
    }

    set geodesic(value: boolean) {
        if (this._isReal) {
            this._android.setGeodesic(value);
        } else {
            this._android.geodesic(value);
        }
    }

    get android() {
        return this._android;
    }

    set android(android) {
        this._android = android;
        this._isReal = android.getClass().getName() === Polyline.CLASS;
    }
}

export class Polygon extends PolygonBase {
    private _android: any;
    private _strokeColor: Color;
    private _fillColor: Color;
    private _isReal: boolean = false;

    static CLASS = 'com.google.android.gms.maps.model.Polygon';

    constructor() {
        super();
        this.android = new com.google.android.gms.maps.model.PolygonOptions();
        this._points = [];
    }

    get clickable() {
        return this._android.isClickable();
    }

    set clickable(value: boolean) {
        if (this._isReal) {
            this._android.setClickable(value);
        } else {
            this._android.clickable(value);
        }
    }

    get zIndex() {
        return this._android.getZIndex();
    }

    set zIndex(value: number) {
        if (this._isReal) {
            this._android.setZIndex(value);
        } else {
            this._android.zIndex(value);
        }
    }

    get visible() {
        return this._android.isVisible();
    }

    set visible(value: boolean) {
        if (this._isReal) {
            this._android.setVisible(value);
        } else {
            this._android.visible(value);
        }
    }

    loadPoints(): void {
        if (!this._isReal) {
            this._points.forEach((point: Position) => {
                this._android.add(point.android);
            });
        }
    }

    reloadPoints(): void {
        if (this._isReal) {
            var points = new java.util.ArrayList();
            this._points.forEach((point: Position) => {
                points.add(point.android);
            });
            this._android.setPoints(points);
        }
    }

    get strokeWidth() {
        return this._android.getStrokeWidth();
    }

    set strokeWidth(value: number) {
        if (this._isReal) {
            this._android.setStrokeWidth(value);
        } else {
            this._android.strokeWidth(value);
        }
    }

    get strokeColor() {
        return this._strokeColor;
    }

    set strokeColor(value: Color) {
        this._strokeColor = value;
        if (this._isReal) {
            this._android.setStrokeColor(value.android);
        } else {
            this._android.strokeColor(value.android);
        }
    }

    get fillColor() {
        return this._fillColor;
    }

    set fillColor(value: Color) {
        this._fillColor = value;
        if (this._isReal) {
            this._android.setFillColor(value.android);
        } else {
            this._android.fillColor(value.android);
        }
    }

    get android() {
        return this._android;
    }

    set android(android) {
        this._android = android;
        this._isReal = android.getClass().getName() === Polygon.CLASS;
    }
}

export class Circle extends CircleBase {
    private _android: any;
    private _center: Position;
    private _strokeColor: Color;
    private _fillColor: Color;
    private _isReal: boolean = false;

    static CLASS = 'com.google.android.gms.maps.model.Circle';

    constructor() {
        super();
        this.android = new com.google.android.gms.maps.model.CircleOptions();
    }

    get clickable() {
        return this._android.isClickable();
    }

    set clickable(value: boolean) {
        if (this._isReal) {
            this._android.setClickable(value);
        } else {
            this._android.clickable(value);
        }
    }

    get zIndex() {
        return this._android.getZIndex();
    }

    set zIndex(value: number) {
        if (this._isReal) {
            this._android.setZIndex(value);
        } else {
            this._android.zIndex(value);
        }
    }

    get visible() {
        return this._android.isVisible();
    }

    set visible(value: boolean) {
        if (this._isReal) {
            this._android.setVisible(value);
        } else {
            this._android.visible(value);
        }
    }

    get center() {
        return this._center;
    }

    set center(value: Position) {
        this._center = value;
        if (this._isReal) {
            this._android.setCenter(value.android);
        } else {
            this._android.center(value.android);
        }
    }

    get radius() {
        return this._android.getRadius();
    }

    set radius(value: number) {
        if (this._isReal) {
            this._android.setRadius(value);
        } else {
            this._android.radius(value);
        }
    }

    get strokeWidth() {
        return this._android.getStrokeWidth();
    }

    set strokeWidth(value: number) {
        if (this._isReal) {
            this._android.setStrokeWidth(value);
        } else {
            this._android.strokeWidth(value);
        }
    }

    get strokeColor() {
        return this._strokeColor;
    }

    set strokeColor(value: Color) {
        this._strokeColor = value;
        if (this._isReal) {
            this._android.setStrokeColor(value.android);
        } else {
            this._android.strokeColor(value.android);
        }
    }

    get fillColor() {
        return this._fillColor;
    }

    set fillColor(value: Color) {
        this._fillColor = value;
        if (this._isReal) {
            this._android.setFillColor(value.android);
        } else {
            this._android.fillColor(value.android);
        }
    }

    get android() {
        return this._android;
    }

    set android(android) {
        this._android = android;
        this._isReal = android.getClass().getName() === Circle.CLASS;
    }
}
