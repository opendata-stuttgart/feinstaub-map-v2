// import leaflet
import leaflet from "leaflet";
import hash from "leaflet-hash";
import * as GeoSearch from "leaflet-geosearch";
import * as L from "leaflet";
import "leaflet-geosearch/dist/geosearch.css";

// d3 libraries
import * as d3_Hexbin from "d3-hexbin";
import * as d3_Selection from "d3-selection";
import * as d3_Transition from "d3-transition";
import {scaleLinear, scaleTime} from "d3-scale";
import {geoPath, geoTransform} from "d3-geo";
import {timeFormatLocale, timeParse} from "d3-time-format";
import {interpolateRgb} from "d3-interpolate";
import {median} from "d3-array";
import "whatwg-fetch";

const d3 = Object.assign({}, d3_Selection, d3_Hexbin);

import api from "./feinstaub-api";
import labs from "./labs.js";
import wind from "./wind.js";
import s2s from "./s2s.js";
import * as config from "./config.js";
import * as places from "../data/places.js";
import * as zooms from "../data/zooms.js";
import * as translate from "./translate.js";
import * as no2data from "../data/no2.json";
import * as stations from "../data/stations.json";
import * as s2s_data from "../data/s2s_data.json";

import "../images/labMarker.svg";
import "../images/schoolMarker.svg";
import "../images/favicon.ico";
import "../css/style.css";
import "../css/leaflet.css";

let hexagonheatmap,
    hmhexaPM_aktuell,
    hmhexaPM_AQI,
    hmhexa_t_h_p,
    hmhexa_noise,
    hmhexaPM_WHO,
    hmhexaPM_EU;

let mobile = mobileCheck();

const lang = translate.getFirstBrowserLanguage().substring(0, 2); // save browser lanuage for translation
let openedGraph1 = [];
let timestamp_data = ""; // needs to be global to work over all 4 data streams
let timestamp_from = ""; // needs to be global to work over all 4 data streams
let clicked = null;
let user_selected_value = config.sensor;
let coordsCenter = config.initialView;
let zoomLevel = config.initialZoom;
const locale = timeFormatLocale(config.locale);
const map = L.map("map", {
    preferCanvas: true,
    zoomControl: false,
    controls: false,
    // scrollWheelZoom:false
}).setView(config.initialView, config.initialZoom);
map.attributionControl.setPosition("bottomleft");

map.createPane('markerPane1');
map.createPane('markerPane2');

let arrayCountSensorsHexPM;
let arrayCountSensorsHexEUWHOAQI;
let arrayCountSensorsHexT;
let arrayCountSensorsHexH;
let arrayCountSensorsHexP;
let arrayCountSensorsHexNoise;

let windLayerRetrieved = false;
let labsLayerRetrieved = false;

let dataPointsNO2;
let stationsPoints;
let sensorsPoints;
let sensorsLocations;
let circleRadii = new L.layerGroup().addTo(map);
let coo = [];

let stationsInBounds;
let sensorsInBounds;

let sensorsInBoundsHex;

let mapBounds;

let max = 0;
let min = 0;

let radios = document.querySelectorAll('input[type=radio]')
let prev = 250;

for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', function () {
        if (this !== prev) {
            prev = this.value;
            //  document.getElementById('legend_Reference').style.diplay = 'none';
            circleRadii.clearLayers();
            if (map.hasLayer(stationsPoints) && map.hasLayer(sensorsPoints) && (prev == 250 && zoomLevel > 12) || (prev == 1000 && zoomLevel > 10)) {
                stationsInBounds.forEach(function (e) {
                    e.count250 = 0;
                    e.count1000 = 0
                });
                countDistance();
                drawCircles();
                stationsPoints.bringToFront();
                sensorsPoints.bringToFront();
            }
        }
    });
}

let dateNO2 = "all";

document.querySelector("#dateNO2").addEventListener('change', function () {
    map.removeLayer(dataPointsNO2);

    dateNO2 = this.value;

    dataPointsNO2 = L.geoJSON(no2data.default, {
        pointToLayer: function (feature, latlng) {

            if (dateNO2 === "all") {

                return L.circleMarker(latlng, {
                    radius: responsiveRadius(mobile),
                    fillColor: colorScale(feature.properties.value),
                    weight: 2,
                    stroke: false,
                    fillOpacity: 1,
                });

            } else if (dateNO2 === feature.properties.stop.substring(0, 7)) {
                return L.circleMarker(latlng, {
                    radius: responsiveRadius(mobile),
                    fillColor: colorScale(feature.properties.value),
                    weight: 2,
                    stroke: false,
                    fillOpacity: 1,
                });
            }
        },
        onEachFeature: function (feature, layer) {
            var popupContent;
            if (feature.properties.campaign == "DUH") {
                popupContent = "<h2>DUH</h2><p><b>City</b> : " + feature.properties.city + "</p><p><b>Info</b> : " + feature.properties.info + "</p><p><b>Timespan</b> : " + feature.properties.start + " - " + feature.properties.stop + "</p><b>Value</b> : " + feature.properties.value + " µg\/m&sup3; (average concentration for the month)</p>";

            }
            if (feature.properties.campaign == "SC") {
                var traficLevel;
                if (feature.properties.trafic == 0) {
                    traficLevel = "low"
                } else {
                    traficLevel = "high"
                }
                if (feature.properties.value != 0 && feature.properties.remark == "") {
                    popupContent = "<h2>Sensor.Community</h2><p><b>City</b> : " + feature.properties.city + "</p><p><b>Group</b> : <a target='_blank' rel='noopener noreferrer' href='" + feature.properties.link + "'>" + feature.properties.group + "</a></p><p><b>Tube ID</b> : " + feature.properties.tubeId + "</p><p><b>Height</b> : " + feature.properties.height + " m</p><p><b>Trafic</b> : " + traficLevel + "</p><p><b>Information</b> : " + feature.properties.info + "<br><br><b>Value</b> : " + feature.properties.value + " µg\/m&sup3; (average concentration for the month)</p>";
                } else {
                    popupContent = "<h2>Sensor.Community</h2><p><b>City</b> : " + feature.properties.city + "</p><p><b>Group</b> : <a target='_blank' rel='noopener noreferrer' href='" + feature.properties.link + "'>" + feature.properties.group + "</a></p><p><b>Tube ID</b> : " + feature.properties.tubeId + "</p><p><b>Height</b> : " + feature.properties.height + " m</p><p><b>Trafic</b> : " + traficLevel + "</p><p><b>Information</b> : " + feature.properties.info + "<br><br><b>Remark</b> : " + feature.properties.remark + "</p>";
                }
            }
            layer.bindPopup(popupContent, {closeButton: true, maxWidth: "auto"});
        }

    })
        .addTo(map)
        .bringToFront();
});


const scale_options = {
    NO2: {
        valueDomain: [0, 20, 30, 40, 50, 200],
        colorRange: [
            "#4B8246",
            "#4B8246",
            "#9FD08C",
            "#EFEDB4",
            "#F47A70",
            "#8C161E",
        ],
    },
};

var colorScale = scaleLinear()
    .domain(scale_options.NO2.valueDomain)
    .range(scale_options.NO2.colorRange)
    .interpolate(interpolateRgb);


config.tiles = config.tiles_server + config.tiles_path;
L.tileLayer(config.tiles, {
    maxZoom: config.maxZoom,
    minZoom: config.minZoom,
    subdomains: config.tiles_subdomains,
}).addTo(map);
// Adds query and hash parameter to the current URL
new L.Hash(map);

// iife function to read query parameter from URL
(function () {
    let query_value;
    const search_values = location.search.replace("?", "").split("&");
    for (let i = 0; i < search_values.length; i++) {
        query_value = search_values[i].split("=");
        typeof query_value[0] != "sensor" && undefined
            ? (user_selected_value = query_value[1])
            : (user_selected_value = config.sensor);
    }
})();

document.querySelector("#loading").innerText = translate.tr(
    lang,
    "Loading data..."
);

// read zoom level and coordinates query parameter from URL
if (location.hash) {
    const hash_params = location.hash.split("/");
    coordsCenter = [hash_params[1], hash_params[2]];
    zoomLevel = hash_params[0].substring(1);
} else {
    const hostname_parts = location.hostname.split(".");
    if (hostname_parts.length === 4) {
        const place = hostname_parts[0].toLowerCase();
        if (typeof places[place] !== "undefined" && places[place] !== null) {
            coordsCenter = places[place];
            zoomLevel = 11;
        }
        if (typeof zooms[place] !== "undefined" && zooms[place] !== null)
            zoomLevel = zooms[place];
    }
}

window.onload = function () {
    L.HexbinLayer = L.Layer.extend({
        _undef(a) {
            return typeof a === "undefined";
        },
        options: {
            radius: 25,
            opacity: 0.6,
            duration: 200,
            attribution: config.attribution,
            click: function (d) {
                setTimeout(function () {
                    if (clicked === null) sensorNr(d);
                    clicked += 1;
                }, 500);
            },

            lng: function (d) {
                return d.longitude;
            },
            lat: function (d) {
                return d.latitude;
            },
            value: function (d) {
                return data_median(d);
            },
        },

        initialize(options) {
            L.setOptions(this, options);
            this._data = [];
            this._colorScale = scaleLinear()
                .domain(this.options.valueDomain)
                .range(this.options.colorRange)
                .clamp(true);
        },

        // Make hex radius dynamic for different zoom levels to give a nicer overview of the sensors as well as making sure that the hex grid does not cover the whole world when zooming out
        getFlexRadius() {
            if (this.map.getZoom() < 3) {
                return this.options.radius / (3 * (4 - this.map.getZoom()));
            } else if (this.map.getZoom() > 2 && this.map.getZoom() < 8) {
                return this.options.radius / (9 - this.map.getZoom());
            } else {
                return this.options.radius;
            }
        },

        onAdd(map) {
            this.map = map;
            let _layer = this;

            // SVG element
            this._svg = L.svg();
            map.addLayer(this._svg);
            // Todo: get rid of d3.select and use vanilla js instead
            this._rootGroup = d3
                .select(this._svg._rootGroup)
                .classed("d3-overlay", true);
            this.selection = this._rootGroup;

            // Init shift/scale invariance helper values
            this._pixelOrigin = map.getPixelOrigin();
            this._wgsOrigin = L.latLng([0, 0]);
            this._wgsInitialShift = this.map.latLngToLayerPoint(this._wgsOrigin);
            this._zoom = this.map.getZoom();
            this._shift = L.point(0, 0);
            this._scale = 1;

            // Create projection object
            this.projection = {
                latLngToLayerPoint: function (latLng, zoom) {
                    zoom = _layer._undef(zoom) ? _layer._zoom : zoom;
                    let projectedPoint = _layer.map
                        .project(L.latLng(latLng), zoom)
                        ._round();
                    return projectedPoint._subtract(_layer._pixelOrigin);
                },
                layerPointToLatLng: function (point, zoom) {
                    zoom = _layer._undef(zoom) ? _layer._zoom : zoom;
                    let projectedPoint = L.point(point).add(_layer._pixelOrigin);
                    return _layer.map.unproject(projectedPoint, zoom);
                },
                unitsPerMeter: (256 * Math.pow(2, _layer._zoom)) / 40075017,
                map: _layer.map,
                layer: _layer,
                scale: 1,
            };
            this.projection._projectPoint = function (x, y) {
                let point = _layer.projection.latLngToLayerPoint(new L.LatLng(y, x));
                this.stream.point(point.x, point.y);
            };

            this.projection.pathFromGeojson = geoPath().projection(
                geoTransform({point: this.projection._projectPoint})
            );
            this.projection.latLngToLayerFloatPoint =
                this.projection.latLngToLayerPoint;
            this.projection.getZoom = this.map.getZoom.bind(this.map);
            this.projection.getBounds = this.map.getBounds.bind(this.map);
            this.selection = this._rootGroup; // ???

            // Initial draw
            this.draw();
        },
        addTo(map) {
            map.addLayer(this);
            return this;
        },

        _disableLeafletRounding() {
            this._leaflet_round = L.Point.prototype._round;
            L.Point.prototype._round = function () {
                return this;
            };
        },

        _enableLeafletRounding() {
            L.Point.prototype._round = this._leaflet_round;
        },

        draw() {
            this._disableLeafletRounding();
            this._redraw(this.selection, this.projection, this.map.getZoom());
            this._enableLeafletRounding();
        },
        getEvents: function () {
            return {
                moveend: this._moveChange,
                zoomend: this._zoomChange
            };
        },

        _zoomChange: function () {
            if (user_selected_value !== "NO2" && user_selected_value !== "Reference") {
                let mapZoom = map.getZoom();
                this._disableLeafletRounding();
                let newZoom = this._undef(mapZoom) ? this.map._zoom : mapZoom;
                this._zoomDiff = newZoom - this._zoom;
                this._scale = Math.pow(2, this._zoomDiff);
                this.projection.scale = this._scale;
                this._shift = this.map
                    .latLngToLayerPoint(this._wgsOrigin)
                    ._subtract(this._wgsInitialShift.multiplyBy(this._scale));
                let shift = ["translate(", this._shift.x, ",", this._shift.y, ") "];
                let scale = ["scale(", this._scale, ",", this._scale, ") "];
                this._rootGroup.attr("transform", shift.concat(scale).join(""));
                this.draw();
                this._enableLeafletRounding();
            }

        },
        _moveChange: function () {

            // if(zoomDetect == false){
            let mapZoom = map.getZoom();
            this._disableLeafletRounding();
            let newZoom = this._undef(mapZoom) ? this.map._zoom : mapZoom;
            this._zoomDiff = newZoom - this._zoom;
            this._scale = Math.pow(2, this._zoomDiff);
            this.projection.scale = this._scale;
            this._shift = this.map
                .latLngToLayerPoint(this._wgsOrigin)
                ._subtract(this._wgsInitialShift.multiplyBy(this._scale));
            let shift = ["translate(", this._shift.x, ",", this._shift.y, ") "];
            let scale = ["scale(", this._scale, ",", this._scale, ") "];
            this._rootGroup.attr("transform", shift.concat(scale).join(""));
            this.draw();
            this._enableLeafletRounding();
        },
        _redraw(selection, projection, zoom) {
            // Generate the mapped version of the data
            let data = this._data.map((d) => {
                let lng = this.options.lng(d);
                let lat = this.options.lat(d);
                let point = projection.latLngToLayerPoint([lat, lng]);
                return {o: d, point: point};
            });

            // Select the hex group for the current zoom level. This has
            // the effect of recreating the group if the zoom level has changed
            let join = selection.selectAll("g.hexbin").data([zoom], (d) => d);

            join
                .enter()
                .append("g")
                .attr("class", (d) => "hexbin zoom-" + d);

            join.exit().remove();

            // add the hexagons to the select
            this._createHexagons(join, data, projection);

        },

        _createHexagons(g, data, projection) {
            // Create the bins using the hexbin layout

            let hexbin = d3
                .hexbin()
                .radius(this.getFlexRadius() / projection.scale)
                .x((d) => d.point.x)
                .y((d) => d.point.y);

            let bins = hexbin(data);

            // Join - Join the Hexagons to the data
            let join = g.selectAll("path.hexbin-hexagon").data(bins);

            // Update - set the fill and opacity on a transition (opacity is re-applied in case the enter transition was cancelled)
            join
                .transition()
                .duration(this.options.duration)
                .attr("fill", (d) =>
                    typeof this.options.value(d) === "undefined"
                        ? "#808080"
                        : this._colorScale(this.options.value(d))
                )
                .attr("fill-opacity", this.options.opacity)
                .attr("stroke-opacity", this.options.opacity);
            //.attr("stroke-width", "0%");

            // Enter - establish the path, the fill, and the initial opacity
            join
                .enter()
                .append("path")
                .attr("class", "hexbin-hexagon")
                .attr("d", (d) => "M" + d.x + "," + d.y + hexbin.hexagon())
                .attr("fill", (d) =>
                    typeof this.options.value(d) === "undefined"
                        ? "#808080"
                        : this._colorScale(this.options.value(d))
                )
                .on("click", this.options.click)
                .transition()
                .duration(this.options.duration)
                .attr("fill-opacity", this.options.opacity)
                .attr("stroke-opacity", this.options.opacity);
            join
                .exit()
                .transition()
                .duration(this.options.duration)
                .attr("fill-opacity", this.options.opacity)
                .attr("stroke-opacity", this.options.opacity)
                .remove();
        },
        data(data) {
            this._data = data != null ? data : [];
            this.draw();
            return this;
        },
    });

    L.hexbinLayer = function (options) {
        return new L.HexbinLayer(options);
    };

    map.setView(coordsCenter, zoomLevel);
    map.clicked = 0;

    hexagonheatmap = L.hexbinLayer(
        config.scale_options[user_selected_value]
    ).addTo(map);

    async function retrieveData() {
        await api
            .getData(config.data_host + "/data/v2/data.dust.min.json", "pmDefault")
            .then(function (result) {
                if (document.querySelector("#indoor").checked) {
                    hmhexaPM_aktuell = result.cells;
                } else {
                    hmhexaPM_aktuell = result.cells.filter(e => e.indoor == 0);
                }
                LatLngMapper(hmhexaPM_aktuell, "PM");
                sensorsLocations = result.cells2;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
            })
            .then(function () {
                ready("reference");
                ready("pmDefault");
            });

        await api
            .getData(config.data_host + "/data/v2/data.24h.json")
            .then(function (result) {
                if (document.querySelector("#indoor").checked) {
                    hmhexaPM_WHO = result.cells;
                } else {
                    hmhexaPM_WHO = result.cells.filter(e => e.indoor == 0);
                }
                if (document.querySelector("#indoor").checked) {
                    hmhexaPM_EU = result.cells;
                } else {
                    hmhexaPM_EU = result.cells.filter(e => e.indoor == 0);
                }
                if (document.querySelector("#indoor").checked) {
                    hmhexaPM_AQI = result.cells;
                } else {
                    hmhexaPM_AQI = result.cells.filter(e => e.indoor == 0);
                }
                LatLngMapper(hmhexaPM_WHO, "EUWHOAQI");
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
            })
            .then(function () {
                ready("pmWHO");
                ready("pmEU");
                ready("aqi");
            });

        await api
            .getData(config.data_host + "/data/v2/data.temp.min.json", "tempHumPress")
            .then(function (result) {
                //hmhexa_t_h_p = result.cells;
                if (document.querySelector("#indoor").checked) {
                    hmhexa_t_h_p = result.cells;
                } else {
                    hmhexa_t_h_p = result.cells.filter(e => e.indoor == 0);
                }
                LatLngMapper(hmhexa_t_h_p, "Temperature");
                LatLngMapper(hmhexa_t_h_p, "Humidity");
                LatLngMapper(hmhexa_t_h_p, "Pressure");
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
            })
            .then(() => ready("tempHumPress"));

        await api
            .getData(config.data_host + "/data/v1/data.noise.json", "noise")
            .then(function (result) {
                //hmhexa_noise = result.cells;
                if (document.querySelector("#indoor").checked) {
                    hmhexa_noise = result.cells;
                } else {
                    hmhexa_noise = result.cells.filter(e => e.indoor == 0);
                }
                LatLngMapper(hmhexa_noise, "Noise");
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
            })
            .then(() => ready("noise"));
    }

    function LatLngMapper(array, selector) {
        const locations = array.map(e => new L.LatLng(e.latitude, e.longitude));

        switch (selector) {
            case "PM":
                arrayCountSensorsHexPM = locations;
                break;
            case "EUWHOAQI":
                arrayCountSensorsHexEUWHOAQI = locations;
                break;
            case "Temperature":
                arrayCountSensorsHexT = array.filter(e => !isNaN(e.data.Temperature)).map(e => new L.LatLng(e.latitude, e.longitude));
                break;
            case "Humidity":
                arrayCountSensorsHexH = array.filter(e => !isNaN(e.data.Humidity)).map(e => new L.LatLng(e.latitude, e.longitude));
                break;
            case "Pressure":
                arrayCountSensorsHexP = array.filter(e => !isNaN(e.data.Pressure)).map(e => new L.LatLng(e.latitude, e.longitude));
                break;
            case "Noise":
                arrayCountSensorsHexNoise = locations;
                break;
            default:
                console.error("Invalid selector provided:", selector);
        }
    }

    function ready(vizType) {
        const date = new Date();
        const dateParser = timeParse("%Y-%m-%d %H:%M:%S");
        const getOffsetHours = date.getTimezoneOffset() * 60000;
        const logTimestamp = dateParser(timestamp_data).getTime();
        const lastUpdateTimestamp = logTimestamp + -getOffsetHours;
        const dateFormater = locale.format("%d.%m.%Y %H:%M:%S");

        document.querySelector("#lastUpdate").innerText =
            translate.tr(lang, "Last update") +
            " " +
            dateFormater(lastUpdateTimestamp);
        document.querySelector("#menuButton").innerText =
            document.querySelector(".selected").innerText;


        if (
            vizType === "pmWHO" &&
            (user_selected_value === "PM10who" || user_selected_value === "PM25who")
        ) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_WHO);
            d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
            d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
        }

        if (
            vizType === "pmEU" &&
            (user_selected_value === "PM10eu" || user_selected_value === "PM25eu")
        ) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_EU);
            d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
            d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
        }

        if (vizType === "aqi" && user_selected_value === "AQIus") {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_AQI);
            d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
            d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
        }

        if (
            vizType === "tempHumPress" &&
            ["Temperature", "Humidity", "Pressure"].includes(user_selected_value)
        ) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexa_t_h_p.filter(value => api.checkValues(value.data[user_selected_value], user_selected_value)));
            const sensorCountArray = {
                Temperature: arrayCountSensorsHexT,
                Humidity: arrayCountSensorsHexH,
                Pressure: arrayCountSensorsHexP,
            };
            d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(sensorCountArray[user_selected_value]));
            d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(sensorCountArray[user_selected_value].length);
        }

        if (vizType === "noise" && user_selected_value === "Noise") {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexa_noise);
            d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexNoise));
            d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexNoise.length);
        }

        if (vizType === "pmDefault" && (user_selected_value === "PM25" || user_selected_value === "PM10")) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_aktuell);
            d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexPM));
            d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexPM.length);
        }

        if (vizType === "Reference" && user_selected_value === "Reference") {

            sensorsPoints = L.geoJSON(sensorsLocations, {
                pointToLayer: function (feature, latlng) {

                    coo.push(latlng);

                    return L.circleMarker(latlng, {
                        className: 'sensor',
                        radius: responsiveRadius(mobile),
                        fillColor: 'red',
                        stroke: false,
                        fillOpacity: 1
                    })
                },
                onEachFeature: function (feature, layer) {
                    var position;
                    if (feature.properties.indoor == 0) {
                        position = "outdoor"
                    } else {
                        position = "indoor"
                    }
                    var popupContent = "<h1>Sensor.Community #" + feature.properties.id + "</h1><p><b>Type: </b>" + feature.properties.type + "</p><p><b>Position: </b>" + position + "</p>";
                    layer.bindPopup(popupContent, {closeButton: true, maxWidth: "auto"});
                }
            }).addTo(map);

            boundsCountSensors(sensorsPoints._layers);
            if ((prev == 250 && zoomLevel > 12) || (prev == 1000 && zoomLevel > 10)) {
                countDistance();
            }
            drawCircles();
            stationsPoints.bringToFront();
            sensorsPoints.bringToFront();
            document.getElementById("radiocontainer").style.display = "block";
        }

        document.querySelector("#loading").style.display = "none";
    }

    retrieveData();

    map.on('move', function () {
        circleRadii.clearLayers()
    });

    map.on('zoom', function () {
        circleRadii.clearLayers()
    });

    map.on("moveend", function () {
        if (user_selected_value !== "NO2" && user_selected_value !== "Reference") {

            if (user_selected_value === "PM10" || user_selected_value === "PM25") {
                if (arrayCountSensorsHexPM != undefined) {
                    d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexPM));
                    d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexPM.length);
                }
            }

            if (user_selected_value === "PM10eu" || user_selected_value === "PM25eu") {
                if (arrayCountSensorsHexEUWHOAQI != undefined) {
                    d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
                    d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
                }
            }

            if (user_selected_value === "PM10who" || user_selected_value === "PM25who") {
                if (arrayCountSensorsHexEUWHOAQI != undefined) {
                    d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
                    d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
                }
            }

            if (user_selected_value === "AQIus") {
                if (arrayCountSensorsHexEUWHOAQI != undefined) {
                    d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
                    d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
                }
            }

            if (["Temperature", "Humidity", "Pressure"].includes(user_selected_value)) {
                if (user_selected_value == "Temperature") {
                    if (arrayCountSensorsHexT != undefined) {
                        //
                        d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexT));
                        d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexT.length);
                    }

                }
                if (user_selected_value == "Humidity") {
                    if (arrayCountSensorsHexH != undefined) {
                        //
                        d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexH));
                        d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexH.length);
                    }
                }
                if (user_selected_value == "Pressure") {
                    if (arrayCountSensorsHexP != undefined) {
                        //
                        d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexP));
                        d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexP.length);
                    }
                }

            }
            if (user_selected_value === "Noise") {
                if (arrayCountSensorsHexNoise != undefined) {
                    d3.select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexNoise));
                    d3.select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexNoise.length);
                }
            }
        }

        if (user_selected_value === "Reference") {
            zoomLevel = map.getZoom();

            boundsCountStations(stationsPoints._layers);
            boundsCountSensors(sensorsPoints._layers);

            if ((prev == 250 && zoomLevel > 12) || (prev == 1000 && zoomLevel > 10)) {
                countDistance();
                drawCircles();
                stationsPoints.bringToFront();
                sensorsPoints.bringToFront();
            }
        }

    });

    map.on("click", function () {
        clicked = null;
    });
    map.on("dblclick", function () {
        map.zoomIn();
        clicked += 1;
    });


    map.on("zoomend", function () {
        let zl = map.getZoom();
        if (mobile === false && zl <= 9) {
            if (map.hasLayer(dataPointsNO2)) {
                dataPointsNO2.setStyle({radius: 0.1});
            }
            if (map.hasLayer(stationsPoints)) {
                stationsPoints.setStyle({radius: 0.1});
            }
            if (map.hasLayer(sensorsPoints)) {
                sensorsPoints.setStyle({radius: 0.1});
            }
        } else if (mobile == false && zl < 12 && zl > 9) {
            if (map.hasLayer(dataPointsNO2)) {
                dataPointsNO2.setStyle({radius: 5});
            }

            if (map.hasLayer(stationsPoints)) {
                stationsPoints.setStyle({radius: 5});
            }

            if (map.hasLayer(sensorsPoints)) {
                sensorsPoints.setStyle({radius: 5});
            }
        } else if (mobile == false) {

            if (map.hasLayer(dataPointsNO2)) {
                dataPointsNO2.setStyle({radius: 10});
            }
            if (map.hasLayer(stationsPoints)) {
                stationsPoints.setStyle({radius: 10});
            }

            if (map.hasLayer(sensorsPoints)) {
                sensorsPoints.setStyle({radius: 10});
            }
        }
        if (mobile === true && zl <= 9) {

            if (map.hasLayer(dataPointsNO2)) {
                dataPointsNO2.setStyle({radius: 5});
            }
            if (map.hasLayer(stationsPoints)) {
                stationsPoints.setStyle({radius: 5});
            }

            if (map.hasLayer(sensorsPoints)) {
                sensorsPoints.setStyle({radius: 5});
            }
        } else if (mobile == true && zl < 12 && zl > 9) {

            if (map.hasLayer(dataPointsNO2)) {
                dataPointsNO2.setStyle({radius: 15});
            }
            if (map.hasLayer(stationsPoints)) {
                stationsPoints.setStyle({radius: 15});
            }

            if (map.hasLayer(sensorsPoints)) {
                sensorsPoints.setStyle({radius: 15});
            }
        } else if (mobile == true) {

            if (map.hasLayer(dataPointsNO2)) {
                dataPointsNO2.setStyle({radius: 20});
            }
            if (map.hasLayer(stationsPoints)) {
                stationsPoints.setStyle({radius: 20});
            }
            if (map.hasLayer(sensorsPoints)) {
                sensorsPoints.setStyle({radius: 20});
            }
        }
    });

    function data_median(data) {
        function sort_num(a, b) {
            let c = a - b;
            return c < 0 ? -1 : (c = 0 ? 0 : 1);
        }

        let d_temp = data
            .filter((d) => !d.o.indoor)
            .map((o) => o.o.data[user_selected_value])
            .sort(sort_num);
        return median(d_temp);
    }

    function reloadMap(val) {

        document.querySelectorAll("path.hexbin-hexagon").forEach(function (d) {
            d.remove();
        });

        if (map.hasLayer(dataPointsNO2)) {

            map.removeLayer(dataPointsNO2);
        }

        if (map.hasLayer(stationsPoints)) {

            map.removeLayer(stationsPoints);
        }

        if (map.hasLayer(sensorsPoints)) {

            map.removeLayer(sensorsPoints);
        }

        if (map.hasLayer(circleRadii)) {

            circleRadii.clearLayers();
        }

        if (val !== "NO2" && val !== "Reference") {
            hexagonheatmap.initialize(config.scale_options[val]);
            if (val === "PM10" || val === "PM25") {
                hexagonheatmap.data(hmhexaPM_aktuell);
            } else if (val === "PM10eu" || val === "PM25eu") {
                hexagonheatmap.data(hmhexaPM_EU);
            } else if (val === "PM10who" || val === "PM25who") {
                hexagonheatmap.data(hmhexaPM_WHO);
            } else if (val === "AQIus") {
                hexagonheatmap.data(hmhexaPM_AQI);
            } else if (["Temperature", "Humidity", "Pressure"].includes(val)) {
                hexagonheatmap.data(
                    hmhexa_t_h_p.filter(function (value) {
                        return api.checkValues(
                            value.data[user_selected_value],
                            user_selected_value
                        );
                    })
                );
            } else if (val === "Noise") {
                hexagonheatmap.data(hmhexa_noise);
            }
            switchLegend(val);

            if (val === "PM10" || val === "PM25") {
                if (arrayCountSensorsHexPM != undefined) {
                    //
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexPM));
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexPM.length);
                }
            } else if (val === "PM10eu" || val === "PM25eu") {
                if (arrayCountSensorsHexEUWHOAQI != undefined) {
                    //
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
                }
            } else if (val === "PM10who" || val === "PM25who") {
                if (arrayCountSensorsHexEUWHOAQI != undefined) {
                    //
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
                }
            } else if (val === "AQIus") {
                if (arrayCountSensorsHexEUWHOAQI != undefined) {
                    //
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexEUWHOAQI));
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexEUWHOAQI.length);
                }
            } else if (["Temperature", "Humidity", "Pressure"].includes(val)) {
                if (val == "Temperature") {
                    if (arrayCountSensorsHexT != undefined) {
                        //
                        d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexT));
                        d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexT.length);
                    }

                }
                if (val == "Humidity") {
                    if (arrayCountSensorsHexH != undefined) {
                        //
                        d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexH));
                        d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexH.length);
                    }
                }
                if (val == "Pressure") {
                    if (arrayCountSensorsHexP != undefined) {
                        //
                        d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexP));
                        d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexP.length);
                    }

                }

            } else if (val === "Noise") {
                if (arrayCountSensorsHexNoise != undefined) {
                    //
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCount']").html(boundsCountSensorsHex(arrayCountSensorsHexNoise));
                    d3.select("#legend").select("div[style='display: block;']").select("span[class='sensorsCountTotal']").html(arrayCountSensorsHexNoise.length);
                }
            }
        } else {

            if (val === "Reference") {
                stationsPoints = L.geoJSON(stations.default, {
                    pointToLayer: function (feature, latlng) {
                        return L.circleMarker(latlng, {
                            className: 'station',
                            radius: responsiveRadius(mobile),
                            fillColor: 'blue',
                            stroke: false,
                            fillOpacity: 1
                        })
                    },
                    onEachFeature: function (feature, layer) {
                        if (feature.properties.Source == "EEA") {
                            var popupContent = "<h1>Official EU Station</h1><p><b>City: </b>" + feature.properties.Name + "</p><p><b>Area Classification: </b> " + feature.properties.AreaClassification + "</p><p><b>Station Classification ID: </b>" + feature.properties.StationClassification + "</p>";
                        }
                        if (feature.properties.Source == "AQMD") {
                            var monitorString = "";
                            feature.properties.monitors.forEach(function (e) {
                                monitorString += e + "<br>"
                            });
                            var popupContent = "<h1>Official AQMD Station</h1><p><b>Name: </b>" + feature.properties.siteName + "</p><p><b>Monitoring: </b> " + monitorString + "</p>";
                        }
                        layer.bindPopup(popupContent, {closeButton: true, maxWidth: "auto"});
                    }
                }).addTo(map);


                sensorsPoints = L.geoJSON(sensorsLocations, {
                    pointToLayer: function (feature, latlng) {

                        coo.push(latlng);

                        return L.circleMarker(latlng, {
                            className: 'sensor',
                            radius: responsiveRadius(mobile),
                            fillColor: 'red',
                            stroke: false,
                            fillOpacity: 1
                        })
                    },
                    onEachFeature: function (feature, layer) {
                        var position;
                        if (feature.properties.indoor == 0) {
                            position = "outdoor"
                        } else {
                            position = "indoor"
                        }
                        ;
                        var popupContent = "<h1>Sensor.Community #" + feature.properties.id + "</h1><p><b>Type: </b>" + feature.properties.type + "</p><p><b>Position: </b>" + position + "</p>";
                        layer.bindPopup(popupContent, {closeButton: true, maxWidth: "auto"});
                    }
                }).addTo(map);

                boundsCountStations(stationsPoints._layers);
                boundsCountSensors(sensorsPoints._layers);
                if ((prev == 250 && zoomLevel > 12) || (prev == 1000 && zoomLevel > 10)) {
                    countDistance();
                }
                drawCircles();
                stationsPoints.bringToFront();
                sensorsPoints.bringToFront();
                // document.getElementById("loading_layer").style.display ="none";
                // document.getElementById("radiocontainer").style.display ="block";
            }

            if (val === "NO2") {

                dataPointsNO2 = L.geoJSON(no2data.default, {
                    pointToLayer: function (feature, latlng) {

                        if (dateNO2 === "all") {

                            return L.circleMarker(latlng, {
                                radius: responsiveRadius(mobile),
                                fillColor: colorScale(feature.properties.value),
                                stroke: true,
                                weight: 2,
                                stroke: false,
                                fillOpacity: 1,
                            });
                        } else if (dateNO2 === feature.properties.stop.substring(0, 7)) {

                            return L.circleMarker(latlng, {
                                radius: responsiveRadius(mobile),
                                fillColor: colorScale(feature.properties.value),
                                stroke: true,
                                weight: 2,
                                stroke: false,
                                fillOpacity: 1,
                            });

                        }

                    },
                    onEachFeature: function (feature, layer) {
                        var popupContent;
                        if (feature.properties.campaign == "DUH") {
                            popupContent = "<h2>DUH</h2><p><b>City</b> : " + feature.properties.city + "</p><p><b>Info</b> : " + feature.properties.info + "</p><p><b>Timespan</b> : " + feature.properties.start + " - " + feature.properties.stop + "</p><b>Value</b> : " + feature.properties.value + " µg\/m&sup3; (average concentration for the month)</p>";

                        }
                        if (feature.properties.campaign == "SC") {
                            var traficLevel;
                            //
                            if (feature.properties.trafic == 0) {
                                traficLevel = "low"
                            } else {
                                traficLevel = "high"
                            }
                            if (feature.properties.value != 0 && feature.properties.remark == "") {
                                popupContent = "<h2>Sensor.Community</h2><p><b>City</b> : " + feature.properties.city + "</p><p><b>Group</b> : <a target='_blank' rel='noopener noreferrer' href='" + feature.properties.link + "'>" + feature.properties.group + "</a></p><p><b>Tube ID</b> : " + feature.properties.tubeId + "</p><p><b>Height</b> : " + feature.properties.height + " m</p><p><b>Trafic</b> : " + traficLevel + "</p><p><b>Information</b> : " + feature.properties.info + "<br><br><b>Value</b> : " + feature.properties.value + " µg\/m&sup3; (average concentration for the month)</p>";
                            } else {
                                popupContent = "<h2>Sensor.Community</h2><p><b>City</b> : " + feature.properties.city + "</p><p><b>Group</b> : <a target='_blank' rel='noopener noreferrer' href='" + feature.properties.link + "'>" + feature.properties.group + "</a></p><p><b>Tube ID</b> : " + feature.properties.tubeId + "</p><p><b>Height</b> : " + feature.properties.height + " m</p><p><b>Trafic</b> : " + traficLevel + "</p><p><b>Information</b> : " + feature.properties.info + "<br><br><b>Remark</b> : " + feature.properties.remark + "</p>";
                            }
                        }
                        layer.bindPopup(popupContent, {closeButton: true, maxWidth: "auto"});
                    }
                })
                    .addTo(map)
                    .bringToFront();
            }
        }
    }

    function sensorNr(data) {
        openMenu();
        document.getElementById("mainContainer").style.display = "none"; // hide menu content
        let textefin =
            "<table id='results' style='width:95%;'><tr><th class ='title'>" +
            translate.tr(lang, "Sensor") +
            "</th><th class = 'title'>" +
            translate.tr(lang, config.tableTitles[user_selected_value]) +
            "</th></tr>";
        if (data.length > 1) {
            textefin +=
                "<tr><td class='idsens'>Median " +
                data.length +
                " Sensors</td><td>" +
                (isNaN(parseInt(data_median(data)))
                    ? "-"
                    : parseInt(data_median(data))) +
                "</td></tr>";
        }
        let sensors = "";
        data.forEach(function (i) {
            sensors +=
                "<tr><td class='idsens' id='id_" +
                i.o.id +
                (i.o.indoor ? "_indoor" : "") +
                "'> #" +
                i.o.id +
                (i.o.indoor ? " (indoor)" : "") +
                "</td>";
            if (
                [
                    "PM10",
                    "PM25",
                    "PM10eu",
                    "PM25eu",
                    "PM10who",
                    "PM25who",
                    "Temperature",
                    "Humidity",
                    "Noise",
                ].includes(user_selected_value)
            ) {
                sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
            }
            if (user_selected_value === "AQIus") {
                sensors +=
                    "<td>" +
                    i.o.data[user_selected_value] +
                    " (" +
                    i.o.data.origin +
                    ")</td></tr>";
            }
            if (user_selected_value === "Pressure") {
                sensors +=
                    "<td>" + i.o.data[user_selected_value].toFixed(1) + "</td></tr>";
            }
            sensors += "<tr id='graph_" + i.o.id + "'></tr>";
        });
        textefin += sensors;
        textefin += "</table>";
        document.querySelector("#table").innerHTML = textefin;
        document.querySelectorAll(".idsens").forEach(function (d) {
            d.addEventListener("click", function () {
                displayGraph(this.id); // transfer id e.g. id_67849
            });
        });
    }

    async function displayGraph(id) {
        const panel_str =
            "<iframe src='https://maps.sensor.community/grafana/d-solo/000000004/single-sensor-view?orgId=1&panelId=<PANELID>&var-node=<SENSOR>' frameborder='0' height='300px' width='100%'></iframe>";
        const sens = id.substr(3);
        const sens_id = sens.replace("_indoor", "");
        const sens_desc = sens.replace("_indoor", " (indoor)");

        if (!openedGraph1.includes(sens_id)) {
            openedGraph1.push(sens_id);
            const iframeID = "frame_" + sens_id;
            document
                .querySelector("#graph_" + sens_id)
                .appendChild(document.createElement("td"))
                .setAttribute("id", iframeID);
            document.querySelector("#" + iframeID).setAttribute("colspan", "2");
            document.querySelector("#" + iframeID).innerHTML =
                (config.panelIDs[user_selected_value][0] > 0
                    ? panel_str
                    .replace("<PANELID>", config.panelIDs[user_selected_value][0])
                    .replace("<SENSOR>", sens_id) + "<br/>"
                    : "") +
                (config.panelIDs[user_selected_value][1] > 0
                    ? panel_str
                        .replace("<PANELID>", config.panelIDs[user_selected_value][1])
                        .replace("<SENSOR>", sens_id)
                    : "");

            document.querySelector("#id_" + sens).innerText = "(-) #" + sens_desc;
        } else {
            document.querySelector("#id_" + sens).innerText = "(+) #" + sens_desc;
            document.querySelector("#frame_" + sens_id).remove();
            removeInArray(openedGraph1, sens_id);
        }
    }

    function removeInArray(array) {
        let what,
            a = arguments,
            L = a.length,
            ax;
        while (L > 1 && array.length) {
            what = a[--L];
            while ((ax = array.indexOf(what)) !== -1) {
                array.splice(ax, 1);
            }
        }
        return array;
    }

    function switchTo(user_selected_value) {
        let elem = document.querySelector(`div[value='${user_selected_value}']`);
        document.querySelector(".selected").classList.remove("selected"); // remove class selected
        elem.classList.add("selected");
        reloadMap(user_selected_value);
        switchLegend(user_selected_value);
        closeMenu();
    }

    switchTo(user_selected_value);

    function countrySelector() {
        document
            .querySelector(".countrySelected")
            .classList.remove("countrySelected");
        document.querySelector(`#${this.id}`).classList.add("countrySelected");
        map.setView(places[this.value], zooms[this.value]);
    }

    function switchLabLayer() {
        if (document.querySelector("#cb_labs").checked) {
            labs.getData(config.data_host + "/local-labs/labs.json", map);
            map.getPane("markerPane1").style.visibility = "visible";
        } else {
            map.getPane("markerPane1").style.visibility = "hidden";
        }
    }

    function switchIndoorLayer() {
        retrieveData();
    }

    function switchS2SLayer() {
        if (document.querySelector("#cb_s2s").checked) {
            s2s.getData(s2s_data, map);
            map.getPane("markerPane2").style.visibility = "visible";
        } else {
            map.getPane("markerPane2").style.visibility = "hidden";
        }
    }

    function switchWindLayer() {
        const checked = document.querySelector("#cb_wind").checked;
        document.querySelectorAll(".velocity-overlay").forEach(d => {
            d.style.visibility = checked ? "visible" : "hidden";
        });
        if (checked) {
            wind.getData(config.data_host + "/data/v1/wind.json", map, switchWindLayer);
        }
    }

    function switchLegend(val) {

        document
            .querySelectorAll("[id^=legend_]")
            .forEach((d) => (d.style.display = "none"));
        document.querySelector("#legend_" + val).style.display = "block";
    }

    function openMenu() {
        document.getElementById("menuButton").innerHTML = "&#10006;";
        document.getElementById("modal").style.display = "block";
        document.getElementById("mainContainer").style.display = "block";
    }

    function closeMenu() {
        document.getElementById("modal").style.display = "none";
        document.getElementById("mainContainer").style.display = "none";
        closeExplanation();
        document.querySelector("#menuButton").innerText =
            document.querySelector(".selected").innerText;
        document.querySelector("#results")
            ? document.querySelector("#results").remove()
            : null;
    }

    function toggleMenu() {
        document.getElementById("modal").style.display === "block"
            ? closeMenu()
            : openMenu();
    }

    function openExplanation() {
        document.getElementById("map-info").style.display = "block";
        document.querySelector("#explanation").innerText = translate.tr(
            lang,
            "Hide"
        );
    }

    function closeExplanation() {
        document.getElementById("map-info").style.display = "none";
        document.querySelector("#explanation").innerText = translate.tr(
            lang,
            "Explanation"
        );
    }

    function toggleExplanation() {
        document.getElementById("map-info").style.display === "block"
            ? closeExplanation()
            : openExplanation();
    }

    document.querySelector("#menuButton").onclick = toggleMenu;

    // Load lab and windlayer, init checkboxes
    document.querySelector("#cb_labs").checked = false;
    document.querySelector("#cb_s2s").checked = false;
    document.querySelector("#cb_wind").checked = false;
    document.querySelector("#indoor").checked = false;
    // d3.selectAll("p[class='textCount']").style("diplay", "none");
    //
    //document.querySelector(".textCount").style.display = "none";

    document.querySelector("#label_local_labs").innerText = translate.tr(
        lang,
        "Local labs"
    );
    document.querySelector("#label_sensor_school").innerText = translate.tr(
        lang,
        "Sensor2School"
    );
    document.querySelector("#label_wind_layer").innerText = translate.tr(
        lang,
        "Wind layer"
    );
    document.querySelector("#label_indoor").innerText = translate.tr(
        lang,
        "Show indoor sensors"
    );

    document.querySelector("#cb_labs").addEventListener("change", switchLabLayer);
    document.querySelector("#cb_s2s").addEventListener("change", switchS2SLayer);
    document.querySelector("#cb_wind").addEventListener("change", switchWindLayer);
    document.querySelector("#indoor").addEventListener("change", switchIndoorLayer);

    // translate AQI values
    document.querySelector("#AQI_Good").innerText = translate.tr(lang, "Good");
    document.querySelector("#AQI_Moderate").innerText = translate.tr(
        lang,
        "Moderate"
    );
    document.querySelector("#AQI_Unhealthy_Sensitive").innerText = translate.tr(
        lang,
        "Unhealthy for sensitive"
    );
    document.querySelector("#AQI_Unhealthy").innerText = translate.tr(
        lang,
        "Unhealthy"
    );
    document.querySelector("#AQI_Very_Unhealthy").innerText = translate.tr(
        lang,
        "Very Unhealthy"
    );
    document.querySelector("#AQI_Hazardous").innerText = translate.tr(
        lang,
        "Hazardous"
    );

    // translate menu links
    document.querySelector("#website").innerText = translate.tr(lang, "Website");
    document.querySelector("#forum").innerText = translate.tr(lang, "Forum");
    document.querySelector("#explanation").innerText = translate.tr(
        lang,
        "Explanation"
    );
    document
        .querySelector("#explanation")
        .addEventListener("click", toggleExplanation);
    document.querySelector("#map-info").innerHTML = translate.tr(
        lang,
        "<p>The hexagons represent the median of the current sensor values included in this area, depending on you selected option (PM2.5, temperature,...).</p> \
    <p>A hexagon will display a list of the corresponding sensors as a table. The first row will show you the amount of sensor and the median value.</p> \
    <p>The plus symbol will display <i>individual measurements of the last 24 hours</i> and a <i>24 hours moving average for the last seven days</i>. </br> Due to technical reasons, the first day is blank.</p> \
    <p>Map values are <strong>refreshed every 5 minutes</strong> to fit with the measurement frequency of the multiple airRohr sensors.</p>"
    );

    // refresh data every 5 minutes
    setInterval(function () {
        document.querySelectorAll("path.hexbin-hexagon").forEach((e) => e.remove());
        windLayerRetrieved = labsLayerRetrieved = false;
        retrieveData();
    }, 300000);

    // translate elements
    document.querySelector("#world").innerText = translate.tr(lang, "World");
    document.querySelector("#europe").innerText = translate.tr(lang, "Europe");
    document.querySelector("#northamerica").innerText = translate.tr(
        lang,
        "North America"
    );
    document.querySelector("#southamerica").innerText = translate.tr(
        lang,
        "South America"
    );
    document.querySelector("#asia").innerText = translate.tr(lang, "Asia");
    document.querySelector("#africa").innerText = translate.tr(lang, "Africa");
    document.querySelector("#oceania").innerText = translate.tr(lang, "Oceania");
    document.querySelector("#explanation").innerText = translate.tr(
        lang,
        "Explanation"
    );

    document
        .querySelectorAll(".selectCountry button")
        .forEach((d) => d.addEventListener("click", countrySelector));

    document.querySelectorAll(".select-items div").forEach(function (d) {
        d.addEventListener("click", function () {
            user_selected_value = this.getAttribute("value");
            !(
                user_selected_value ===
                document.querySelector(".selected").getAttribute("value")
            ) && switchTo(user_selected_value);
        });
    });
    if (navigator.share) {
        document.querySelector("#share").addEventListener("click", function () {
            navigator.share({
                title: "Maps.Sensor.Community",
                text: "Maps is a free web app to monitor air quality in your area. You can find more information on Sensor.Community.",
                url: document.location.href,
            });
        });
    } else {
        document.querySelector("#share").style.display = "none";
    }
};

// add searchbox
new GeoSearch.GeoSearchControl({
    style: "bar",
    showMarker: false,
    provider: new GeoSearch.OpenStreetMapProvider(),
}).addTo(map);

function responsiveRadius(bool) {
    let zl = map.getZoom();
    if (mobile == false && zl <= 9) {
        return 0.1;
    } else if (mobile == false && zl < 12 && zl > 9) {
        return 5;
    } else if (mobile == false) {
        return 10;
    }
    if (mobile == true && zl <= 9) {
        return 5;
    } else if (mobile == true && zl < 12 && zl > 9) {
        return 15;
    } else if (mobile == true) {
        return 20;
    }
}

function mobileCheck() {
    let check = false;
    (function (a) {
        if (
            /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
                a
            ) ||
            /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
                a.substr(0, 4)
            )
        )
            check = true;
    })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
}

function boundsCountStations(object) {
    const arrayConv = Object.values(object);
    const mapBounds = map.getBounds();
    const stationsInBounds = arrayConv.filter(e => mapBounds.contains(e._latlng)).map(e => ({
        ...e,
        count250: 0,
        count1000: 0
    }));
    document.getElementById("stationsCountRef").innerHTML = stationsInBounds.length;
}

const boundsCountSensorsHex = (array) => array.filter(e => map.getBounds().contains(e)).length;

const boundsCountSensors = (object) => {
    const sensorsInBounds = Object.values(object).filter(e => map.getBounds().contains(e._latlng));
    document.getElementById("sensorsCountRef").innerHTML = sensorsInBounds.length;
}

function countDistance() {
    stationsInBounds.forEach(function (e) {
        sensorsInBounds.forEach(function (i) {
            if (i._latlng.distanceTo(e._latlng) <= 250) {
                e.count250 += 1
            }
            if (i._latlng.distanceTo(e._latlng) <= 1000) {
                e.count1000 += 1
            }
        });
    });
}

function drawCircles() {
    var zoomLimit = prev === 250 ? 12 : 10;
    var countKey = prev === 250 ? 'count250' : 'count1000';

    if (zoomLevel <= zoomLimit) return;

    max = Math.max.apply(Math, stationsInBounds.map(function (o) {
        return o[countKey];
    }));
    min = Math.min.apply(Math, stationsInBounds.map(function (o) {
        return o[countKey];
    }));

    if (Math.abs(min) === Infinity || Math.abs(max) === Infinity) return;

    document.getElementById('legend_Reference').style.display = 'block';
    document.getElementById('min').innerHTML = min === max && min !== 0 ? "&emsp;" : "&emsp;" + min;
    document.getElementById('max').innerHTML = max !== 0 ? "&emsp;" + max : "&emsp;";

    stationsInBounds.forEach(function (e) {
        circleRadii.addLayer(new L.circle(e._latlng, {
            className: 'radius',
            radius: prev,
            fillColor: setColor(e.count250, e.count1000),
            stroke: true,
            color: setColor(e.count250, e.count1000),
            opacity: 1,
            weight: 1,
            fillOpacity: 0.3
        }).bindPopup(popupMaker(e._latlng)));
    });
}


const setColor = (val1, val2) => {
    const base = max - min;
    let perc;

    if (prev === 250) {
        perc = val1;
    } else if (prev === 1000) {
        perc = val2;
    }

    if (base === 0) {
        perc = max !== 0 && min !== 0 ? 100 : 0;
    } else {
        perc = (perc - min) / base * 100;
    }

    const r = perc === 0 ? 255 : Math.round(510 - 5.10 * perc);
    const g = perc === 0 ? Math.round(5.1 * perc) : 255;
    const h = r * 0x10000 + g * 0x100;

    return '#' + ('0000' + h.toString(16)).slice(-4);
};


const popupMaker = (coo) => {
    const filtered = sensorsInBounds.filter((i) => {
        return prev === 250 ? i._latlng.distanceTo(coo) <= 250 : i._latlng.distanceTo(coo) <= 1000;
    });

    if (filtered.length === 0) {
        return `<h1>No S.C Sensor in ${prev} m radius</h1>`;
    }

    const texte1 = `<table><tr><th><h1>${filtered.length} S.C Sensor(s) in ${prev} m radius</h1></th></tr>`;
    const texte2 = filtered.map((e) => `<tr><td>${e.feature.properties.id}</td></tr>`).join('');

    return `${texte1}${texte2}</table>`;
};