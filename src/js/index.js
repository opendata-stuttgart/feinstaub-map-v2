// import leaflet
import leaflet from 'leaflet';
import hash from 'leaflet-hash';
import * as GeoSearch from 'leaflet-geosearch';
import 'leaflet.locatecontrol';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';

// d3 libraries
import * as d3_Hexbin from "d3-hexbin";
import * as d3_Selection from 'd3-selection';
import * as d3_Transition from "d3-transition";
import {scaleLinear} from 'd3-scale';
import {geoPath, geoTransform} from 'd3-geo';
import {timeMinute} from 'd3-time';
import {timeFormatLocale, timeParse} from 'd3-time-format';
import {median} from 'd3-array';

import 'whatwg-fetch';

const d3 = Object.assign({}, d3_Selection, d3_Hexbin);

import api from './feinstaub-api';
import labs from './labs.js';
import wind from './wind.js';
import * as config from './config.js';

import * as places from './places.js';
import * as zooms from './zooms.js';
import * as translate from './translate.js';

import '../images/lab_marker.png';
import '../images/lab_marker.svg';
import '../css/style.css';

// declare variables
let hexagonheatmap, hmhexaPM_aktuell, hmhexaPM_AQI, hmhexa_t_h_p, hmhexa_noise, hmhexaPM_WHO, hmhexaPM_EU;

// save browser lanuage for translation
const lang = translate.getFirstBrowserLanguage().substring(0, 2);

let openedGraph1 = [];
let timestamp_data = '';			// needs to be global to work over all 4 data streams
let timestamp_from = '';			// needs to be global to work over all 4 data streams
let clicked = null;

const locale = timeFormatLocale({
    "dateTime": "%Y.%m.%d %H:%M:%S",
    "date": "%d.%m.%Y",
    "time": "%H:%M:%S",
    "periods": ["AM", "PM"],
    "days": ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    "shortDays": ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."],
    "months": ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    "shortMonths": ["Jan.", "Feb.", "Mar.", "Apr.", "Mai", "Jun.", "Jul.", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."]
});

const div = d3.select("#sidebar").append("div").attr("id", "table").style("display", "none");

const map = L.map("map", {preferCanvas: true}).setView(config.initialView, config.initialZoom);

config.tiles = config.tiles_server + config.tiles_path;
L.tileLayer(config.tiles, {
    attribution: config.attribution, maxZoom: config.maxZoom, minZoom: config.minZoom, subdomains: config.tiles_subdomains
}).addTo(map);
// Adds query and hash parameter to the current URL
new L.Hash(map);

// iife function to read query parameter from URL
(function () {
    let telem;
    const search_values = location.search.replace('\?', '').split('&');
    for (let i = 0; i < search_values.length; i++) {
        telem = search_values[i].split('=');
        config[telem[0]] = '';
        if (typeof telem[1] != 'undefined') config[telem[0]] = telem[1];
    }
})();

// layers
(config.layer_wind === "false") ? config.layer_wind = 0 : config.layer_wind = 1;
(config.layer_labs === "false") ? config.layer_labs = 0 : config.layer_labs = 1;
(config.layer_euStations === "false") ? config.layer_eustations = 1 : config.layer_eustations = 0;

d3.select("#loading").html(translate.tr(lang, d3.select("#loading").html()));

// Query will overwrite default sensor selection. Query Parameter is PM25, PM10, Temperature, Humidity, Pressure or Noise. Query is case sensitive
config.selection = (config.sensor !== undefined) ? config.sensor : "PM25";
d3.select("#custom-select").select("select").property("value", config.selection);

let user_selected_value = config.selection;
let coordsCenter = config.initialView;
let zoomLevel = config.initialZoom;

if (location.hash) {
    const hash_params = location.hash.split("/");
    coordsCenter = [hash_params[1], hash_params[2]];
    zoomLevel = hash_params[0].substring(1);
} else {
    const hostname_parts = location.hostname.split(".");
    if (hostname_parts.length === 4) {
        const place = hostname_parts[0].toLowerCase();
        if (typeof places[place] !== 'undefined' && places[place] !== null) {
            coordsCenter = places[place];
            zoomLevel = 11;
        }
        if (typeof zooms[place] !== 'undefined' && zooms[place] !== null) zoomLevel = zooms[place];
    }
}

window.onload = function () {
    L.HexbinLayer = L.Layer.extend({
        _undef(a) {
            return typeof a === 'undefined';
        }, options: {
            radius: 25, opacity: 0.6, duration: 200, onmouseover: undefined, onmouseout: undefined,

            attribution: "<br/><span style='font-size:120%'>Measurements: <a href='https://sensor.community/' style='color: red'>Sensor.Community</a> contributors</span><br/><span style='font-size:120%' id='update'></span>",
            click: function (d) {
                setTimeout(function () {
                    if (clicked === null) sensorNr(d);
                    clicked += 1;
                }, 500)
            },

            lng: function (d) {
                return d.longitude;
            }, lat: function (d) {
                return d.latitude;
            }, value: function (d) {
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
            this._rootGroup = d3.select(this._svg._rootGroup).classed('d3-overlay', true);
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
                    let projectedPoint = _layer.map.project(L.latLng(latLng), zoom)._round();
                    return projectedPoint._subtract(_layer._pixelOrigin);
                }, layerPointToLatLng: function (point, zoom) {
                    zoom = _layer._undef(zoom) ? _layer._zoom : zoom;
                    let projectedPoint = L.point(point).add(_layer._pixelOrigin);
                    return _layer.map.unproject(projectedPoint, zoom);
                }, unitsPerMeter: 256 * Math.pow(2, _layer._zoom) / 40075017, map: _layer.map, layer: _layer, scale: 1
            };
            this.projection._projectPoint = function (x, y) {
                let point = _layer.projection.latLngToLayerPoint(new L.LatLng(y, x));
                this.stream.point(point.x, point.y);
            };

            this.projection.pathFromGeojson = geoPath().projection(geoTransform({point: this.projection._projectPoint}));

            // Compatibility with v.1
            this.projection.latLngToLayerFloatPoint = this.projection.latLngToLayerPoint;
            this.projection.getZoom = this.map.getZoom.bind(this.map);
            this.projection.getBounds = this.map.getBounds.bind(this.map);
            this.selection = this._rootGroup; // ???

            // Initial draw
            this.draw();
        },

        onRemove(map) {
            if (this._container != null) this._container.remove();

            // Remove events
            map.off({'moveend': this._redraw}, this);
            this._container = null;
            this._map = null;

            // Explicitly will leave the data array alone in case the layer will be shown again
            // this._data = [];
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
        }, getEvents: function () {
            return {zoomend: this._zoomChange};
        },

        _zoomChange: function () {
            let mapZoom = map.getZoom();
            let MapCenter = map.getCenter();
            this._disableLeafletRounding();
            let newZoom = this._undef(mapZoom) ? this.map._zoom : mapZoom;
            this._zoomDiff = newZoom - this._zoom;
            this._scale = Math.pow(2, this._zoomDiff);
            this.projection.scale = this._scale;
            this._shift = this.map.latLngToLayerPoint(this._wgsOrigin)
                ._subtract(this._wgsInitialShift.multiplyBy(this._scale));
            let shift = ["translate(", this._shift.x, ",", this._shift.y, ") "];
            let scale = ["scale(", this._scale, ",", this._scale, ") "];
            this._rootGroup.attr("transform", shift.concat(scale).join(""));
            this.draw();
            this._enableLeafletRounding();
        }, _redraw(selection, projection, zoom) {
            // Generate the mapped version of the data
            let data = this._data.map((d) => {
                let lng = this.options.lng(d);
                let lat = this.options.lat(d);
                let point = projection.latLngToLayerPoint([lat, lng]);
                return {o: d, point: point};
            });

            // Select the hex group for the current zoom level. This has
            // the effect of recreating the group if the zoom level has changed
            let join = selection.selectAll('g.hexbin')
                .data([zoom], (d) => d);

            // enter
            join.enter().append('g')
                .attr('class', (d) => 'hexbin zoom-' + d);

            // exit
            join.exit().remove();

            // add the hexagons to the select
            this._createHexagons(join, data, projection);

        },

        _createHexagons(g, data, projection) {
            // Create the bins using the hexbin layout
            let hexbin = d3.hexbin()
                .radius(this.getFlexRadius() / projection.scale)
                .x((d) => d.point.x)
                .y((d) => d.point.y);
            let bins = hexbin(data);

            // Join - Join the Hexagons to the data
            let join = g.selectAll('path.hexbin-hexagon')
                .data(bins);

            // Update - set the fill and opacity on a transition (opacity is re-applied in case the enter transition was cancelled)
            join.transition().duration(this.options.duration)
                .attr('fill', (d) => typeof this.options.value(d) === 'undefined' ? '#808080' : this._colorScale(this.options.value(d)))
                .attr('fill-opacity', this.options.opacity)
                .attr('stroke-opacity', this.options.opacity);

            // Enter - establish the path, the fill, and the initial opacity
            join.enter().append('path').attr('class', 'hexbin-hexagon')
                .attr('d', (d) => 'M' + d.x + ',' + d.y + hexbin.hexagon())
                .attr('fill', (d) => typeof this.options.value(d) === 'undefined' ? '#808080' : this._colorScale(this.options.value(d)))
                .attr('fill-opacity', 0.01)
                .attr('stroke-opacity', 0.01)
                .on('mouseover', this.options.mouseover)
                .on('mouseout', this.options.mouseout)
                .on('click', this.options.click)
                .transition().duration(this.options.duration)
                .attr('fill-opacity', this.options.opacity)
                .attr('stroke-opacity', this.options.opacity);

            // Exit
            join.exit()
                .transition().duration(this.options.duration)
                .attr('fill-opacity', 0.01)
                .attr('stroke-opacity', 0.01)
                .remove();
        }, data(data) {
            this._data = (data != null) ? data : [];
            this.draw();
            return this;
        }
    });

    L.hexbinLayer = function (options) {
        return new L.HexbinLayer(options);
    };

    // enable elements
    // d3.select('#legend_PM10').style("display", "block");
    d3.select('#explanation').html(translate.tr(lang, 'Show explanation'));
    d3.select('#map-info').html(translate.tr(lang, "<p>The hexagons represent the median of the current values of the sensors which are contained in the area, according to the option selected (PM10, PM2.5, temperature, relative humidity, pressure, AQI). You can refer to the scale on the left side of the map.</p> \
<p>By clicking on a hexagon, you can display a list of all the corresponding sensors as a table. The first column lists the sensor-IDs. In the first line, you can see the amount of sensor in the area and the median value.</p> \
<p>By clicking on the plus symbol next to a sensor ID, you can display two graphics: the individual measurements for the last 24 hours and the 24 hours floating mean for the last seven days. For technical reasons, the first of the 8 days displayed on the graphic has to stay empty.\
The values are refreshed every 5 minutes in order to fit with the measurement frequency of the Airrohr sensors.</p> \
<p>The Air Quality Index (AQI) is calculated according to the recommandations of the United States Environmental Protection Agency. Further information is available on the official page.(<a href='https://www.airnow.gov/aqi/aqi-basics/'>Link</a>). Hover over the AQI scale to display the levels of health concern.</p>"));


    d3.select("#menu").on("click", toggleSidebar);
    d3.select("#explanation").on("click", toggleExplanation);
    d3.select("#legend_Official_AQI_US").selectAll(".tooltip").on("click", function () {
        window.open('https://www.airnow.gov/index.cfm?action=aqibasics.aqi', '_blank');
        return false;
    });
    d3.select("#AQI_Good").html(" " + translate.tr(lang, "Good<div class='tooltip-div'>Air quality is considered satisfactory, and air pollution poses little or no risk.</div>"));
    d3.select("#AQI_Moderate").html(" " + translate.tr(lang, "Moderate<div class='tooltip-div'>Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people who are unusually sensitive to air pollution.</div>"));
    d3.select("#AQI_Unhealthy_Sensitive").html(" " + translate.tr(lang, "Unhealthy for Sensitive Groups<div class='tooltip-div'>Members of sensitive groups may experience health effects. The general public is not likely to be affected.</div>"));
    d3.select("#AQI_Unhealthy").html(" " + translate.tr(lang, "Unhealthy<div class='tooltip-div'>Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.</div>"));
    d3.select("#AQI_Very_Unhealthy").html(" " + translate.tr(lang, "Very Unhealthy<div class='tooltip-div'>Health alert: everyone may experience more serious health effects.</div>"));
    d3.select("#AQI_Hazardous").html(" " + translate.tr(lang, "Hazardous<div class='tooltip-div'>Health warnings of emergency conditions. The entire population is more likely to be affected.</div>"));

    d3.select("#world").html(translate.tr(lang, "World"));
    d3.select("#europe").html(translate.tr(lang, "Europe"));
    d3.select("#northamerica").html(translate.tr(lang, "North America"));
    d3.select("#southamerica").html(translate.tr(lang, "South America"));
    d3.select("#asia").html(translate.tr(lang, "Asia"));
    d3.select("#africa").html(translate.tr(lang, "Africa"));
    d3.select("#oceania").html(translate.tr(lang, "Oceania"));

    d3.selectAll(".countriesButtons").selectAll("button").on("click", countrySelector);

    d3.select("#website").html(translate.tr(lang, "Website"));
    d3.select("#forum").html(translate.tr(lang, "Forum"));
    d3.select("#sensatref").html(translate.tr(lang, "Map") + " Sensor@RefS");
    d3.select("#no2").html(translate.tr(lang, "Map") + " NO2");

    //	Select
    const custom_select = d3.select("#custom-select");
    custom_select.select("select").property("value", config.selection);
    custom_select.select("select").selectAll("option").each(function () {
        d3.select(this).html(translate.tr(lang, d3.select(this).html()));
    });

    custom_select.append("div").attr("class", "select-items");
    custom_select.select("select").selectAll("option").each(function () {
        custom_select.select(".select-items").append("div").html("<span>" + d3.select(this).html() + "</span>").attr("id", "select-item-" + this.value).attr("value", this.value).on("click", function () {
            switchTo(this);
        });
        custom_select.select("#select-item-Noise").select("span").attr("id", "noise_option");
    });

    // console.log(d3.select(".select-items").selectAll("div"));

    d3.select(".select-items").selectAll("div").each(function () {
        if (this.getAttribute('value') == custom_select.select("select").select("option:checked").node().value) {
            this.setAttribute("class", "select-selected");
        }
    });

    // console.log(custom_select.select("select").select("option:checked").node().value);

    custom_select.style("display", "inline-block");

    switchLegend(user_selected_value);

    map.setView(coordsCenter, zoomLevel);
    map.clicked = 0;
    hexagonheatmap = L.hexbinLayer(config.scale_options[user_selected_value]).addTo(map);

//	REVOIR ORDRE DANS FONCTION READY
    function retrieveData() {
        api.getData(config.data_host + "/data/v2/data.dust.min.json", 1).then(function (result) {
            hmhexaPM_aktuell = result.cells;
            if (result.timestamp > timestamp_data) {
                timestamp_data = result.timestamp;
                timestamp_from = result.timestamp_from;
            }
            ready(1);
            api.getData(config.data_host + "/data/v2/data.24h.json", 5).then(function (result) {
                hmhexaPM_WHO = result.cells;
                // console.log(hmhexaPM_WHO);
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready(5);
            });
            api.getData(config.data_host + "/data/v2/data.24h.json", 6).then(function (result) {
                hmhexaPM_EU = result.cells;
                // console.log(hmhexaPM_EU);
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready(6);
            });
            api.getData(config.data_host + "/data/v2/data.24h.json", 2).then(function (result) {
                hmhexaPM_AQI = result.cells;
                // console.log(hmhexaPM_AQI);
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready(2);
            });
            api.getData(config.data_host + "/data/v2/data.temp.min.json", 3).then(function (result) {
                hmhexa_t_h_p = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready(3);
            });
            api.getData(config.data_host + "/data/v1/data.noise.json", 4).then(function (result) {
                hmhexa_noise = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready(4);
            });
        });
    }

    //retrieve data from api
    retrieveData();

    // refresh data
    setInterval(function () {
        d3.selectAll('path.hexbin-hexagon').remove();
        retrieveData();
    }, 300000);

    map.on('moveend', function () {
        hexagonheatmap._zoomChange();
    });

    map.on('click', function () {
        clicked = null;
    });
    map.on('dblclick', function () {
        map.zoomIn();
        clicked += 1;
    });

    // add searchbox
    new GeoSearch.GeoSearchControl({
        style: 'button', position: 'topleft', showMarker: false, autoClose: true, provider: new GeoSearch.OpenStreetMapProvider(),
    }).addTo(map);

    L.control.locate({position: 'topleft'}).addTo(map);

    // Load lab and windlayer, init checkboxes
    if (config.layer_labs) {
        d3.select("#cb_labs").property("checked", true);
    } else {
        d3.select("#cb_labs").property("checked", false);
    }

    if (config.layer_wind) {
        d3.select("#cb_wind").property("checked", true);
    } else {
        d3.select("#cb_wind").property("checked", false);
    }

    labs.getData(config.data_host + "/local-labs/labs.json", map);
    wind.getData(config.data_host + "/data/v1/wind.json", map, switchWindLayer);

    d3.select("#label_local_labs").html(translate.tr(lang, "Local labs"));
    d3.select("#label_wind_layer").html(translate.tr(lang, "Wind layer"));

    switchLabLayer();
    switchWindLayer();
    d3.select("#cb_labs").on("change", switchLabLayer);
    d3.select("#cb_wind").on("change", switchWindLayer);

}

function switchLabLayer() {
    if (d3.select("#cb_labs").property("checked")) {
        map.getPane('markerPane').style.visibility = "visible";
    } else {
        map.getPane('markerPane').style.visibility = "hidden";
    }
    document.getElementById("sidebar").style.display = "none";
    document.getElementById("menu").innerHTML = "&#9776;";
}

function switchWindLayer() {
    if (d3.select("#cb_wind").property("checked")) {
        d3.selectAll(".velocity-overlay").style("visibility", "visible");
    } else {
        d3.selectAll(".velocity-overlay").style("visibility", "hidden");
    }
    document.getElementById("sidebar").style.display = "none";
    document.getElementById("menu").innerHTML = "&#9776;";
}

function data_median(data) {
    function sort_num(a, b) {
        let c = a - b;
        return (c < 0 ? -1 : (c = 0 ? 0 : 1));
    }

    let d_temp = data.filter(d => !d.o.indoor)
        .map(o => o.o.data[user_selected_value])
        .sort(sort_num);
    return median(d_temp);
}

function switchLegend(val) {
    // console.log(val);
    d3.select('#legendcontainer').selectAll("[id^=legend_]").style("display", "none");
    d3.select('#legend_' + val).style("display", "block");
}

/*  Menu and Dropdown */
function openSidebar() {
    document.getElementById("menu").innerHTML = "&#10006;";
    document.getElementById("sidebar").style.display = "block";
}

function closeSidebar() {
    document.getElementById("menu").innerHTML = "&#9776;";
    document.getElementById("sidebar").style.display = "none";
    d3.select("#results").remove();
}

function toggleSidebar() {
    if (document.getElementById("sidebar").style.display === "block") {
        closeSidebar();
    } else {
        openSidebar();
        document.getElementById("mainContainer").style.display = "block";
        document.getElementById("explanation").style.display = "block";
    }
}

function toggleExplanation() {
    const x = document.getElementById("map-info");
    const y = document.getElementById("mainContainer");

    if (x.style.display === "none") {
        x.style.display = "block";
        y.style.display = "none";
        d3.select("#explanation").html(translate.tr(lang, "Hide explanation"));

    } else {
        x.style.display = "none";
        y.style.display = "block";
        d3.select("#explanation").html(translate.tr(lang, "Show explanation"));
    }
}

function ready(num) {
    const dateParser = timeParse("%Y-%m-%d %H:%M:%S");
    const timestamp = dateParser(timestamp_data);
    const localTime = new Date();
    const timeOffset = localTime.getTimezoneOffset();
    const newTime = timeMinute.offset(timestamp, -(timeOffset));
    const dateFormater = locale.format("%H:%M:%S");

    d3.select("#update").html(translate.tr(lang, "Last update") + ": " + dateFormater(newTime));
    // console.log("Timestamp " + timestamp_data + " from " + timestamp_from);

    d3.select("#current").html(d3.select(".select-selected").select("span").html());

    if (num === 1 && (user_selected_value === "PM10" || user_selected_value === "PM25")) {
        hexagonheatmap.initialize(config.scale_options[user_selected_value]);
        hexagonheatmap.data(hmhexaPM_aktuell);
    }
    if (num === 6 && (user_selected_value === "PM10eu" || user_selected_value === "PM25eu")) {
        hexagonheatmap.initialize(config.scale_options[user_selected_value]);
        hexagonheatmap.data(hmhexaPM_aktuell);
    }
    if (num === 5 && (user_selected_value === "PM10who" || user_selected_value === "PM25who")) {
        hexagonheatmap.initialize(config.scale_options[user_selected_value]);
        hexagonheatmap.data(hmhexaPM_WHO);
    }

    //REVOIR MAP
    if (num === 2 && user_selected_value === "Official_AQI_US") {
        hexagonheatmap.initialize(config.scale_options[user_selected_value]);
        hexagonheatmap.data(hmhexaPM_AQI);
    }
    if (num === 3 && (user_selected_value === "Temperature" || user_selected_value === "Humidity" || user_selected_value === "Pressure")) {
        hexagonheatmap.initialize(config.scale_options[user_selected_value]);
        hexagonheatmap.data(hmhexa_t_h_p.filter(function (value) {
            return api.checkValues(value.data[user_selected_value], user_selected_value);
        }));
    }
    if (num === 4 && user_selected_value === "Noise") {
        hexagonheatmap.initialize(config.scale_options[user_selected_value]);
        hexagonheatmap.data(hmhexa_noise);
    }
    d3.select("#loading_layer").style("display", "none");
}

function reloadMap(val) {
    // console.log(val);
    d3.selectAll('path.hexbin-hexagon').remove();
    // console.log(d3.select(".select-selected").select("span").html());
    d3.select("#current").html(d3.select(".select-selected").select("span").html());
    closeSidebar();
    switchLegend(val);

    hexagonheatmap.initialize(config.scale_options[val]);
    if (val === "PM10" || val === "PM25") {
        hexagonheatmap.data(hmhexaPM_aktuell);
    } else if (val === "PM10eu" || val === "PM25eu") {
        hexagonheatmap.data(hmhexaPM_EU);
    } else if (val === "PM10who" || val === "PM25who") {
        hexagonheatmap.data(hmhexaPM_WHO);
    } else if (val === "Official_AQI_US") {
        hexagonheatmap.data(hmhexaPM_AQI);
    } else if (val === "Temperature" || val === "Humidity" || val === "Pressure") {
        hexagonheatmap.data(hmhexa_t_h_p.filter(function (value) {
            return api.checkValues(value.data[user_selected_value], user_selected_value);
        }));
    } else if (val === "Noise") {
        hexagonheatmap.data(hmhexa_noise);
    }
}

function sensorNr(data) {
    let inner_pre = "#";
    if (user_selected_value !== "Official_AQI_US") {
        inner_pre = "(+) #";
    }

    openSidebar();

    document.getElementById("mainContainer").style.display = "none";
    document.getElementById("explanation").style.display = "none";

    let textefin = "<table id='results' style='width:380px;'><tr><th class ='title'>" + translate.tr(lang, 'Sensor') + "</th><th class = 'title'>" + translate.tr(lang, config.titles[user_selected_value]) + "</th></tr>";
    if (data.length > 1) {
        textefin += "<tr><td class='idsens'>Median " + data.length + " Sens.</td><td>" + (isNaN(parseInt(data_median(data))) ? "-" : parseInt(data_median(data))) + "</td></tr>";
    }
    let sensors = '';
    data.forEach(function (i) {
        sensors += "<tr><td class='idsens' id='id_" + i.o.id + (i.o.indoor ? "_indoor" : "") + "'>" + inner_pre + i.o.id + (i.o.indoor ? " (indoor)" : "") + "</td>";
        if (user_selected_value === "PM10") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "PM25") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "PM10eu") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "PM25eu") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "PM10who") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "PM25who") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "Official_AQI_US") {
            sensors += "<td>" + i.o.data[user_selected_value] + " (" + i.o.data.origin + ")</td></tr>";
        }
        if (user_selected_value === "Temperature") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "Humidity") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        if (user_selected_value === "Pressure") {
            sensors += "<td>" + i.o.data[user_selected_value].toFixed(1) + "</td></tr>";
        }
        if (user_selected_value === "Noise") {
            sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
        }
        sensors += "<tr id='graph_" + i.o.id + "'></tr>";
    });
    textefin += sensors;
    textefin += "</table>";
    div.transition().duration(200).style("display", "block");
    div.html(textefin).style("padding", "10px");
    d3.selectAll(".idsens").on("click", function () {
        displayGraph(d3.select(this).attr("id"));
    });
}

function displayGraph(id) {

    let inner_pre = "";
    const panel_str = "<iframe src='https://maps.sensor.community/grafana/d-solo/000000004/single-sensor-view?orgId=1&panelId=<PANELID>&var-node=<SENSOR>' width='290' height='200' frameborder='0'></iframe>";
    const sens = id.substr(3);
    const sens_id = sens.replace("_indoor", "");
    const sens_desc = sens.replace("_indoor", " (indoor)");

    if (!openedGraph1.includes(sens_id)) {
        openedGraph1.push(sens_id);

        const iddiv = "#graph_" + sens_id;

        d3.select(iddiv).append("td")
            .attr("id", "frame_" + sens_id)
            .attr("colspan", "2")
            .html((config.panelIDs[user_selected_value][0] > 0 ? panel_str.replace("<PANELID>", config.panelIDs[user_selected_value][0]).replace("<SENSOR>", sens_id) + "<br/>" : "") + (config.panelIDs[user_selected_value][1] > 0 ? panel_str.replace("<PANELID>", config.panelIDs[user_selected_value][1]).replace("<SENSOR>", sens_id) : ""));

        if (user_selected_value !== "Official_AQI_US") inner_pre = "(-) ";
        d3.select("#id_" + sens).html(inner_pre + "#" + sens_desc);
    } else {
        if (user_selected_value !== "Official_AQI_US") inner_pre = "(+) ";
        d3.select("#id_" + sens).html(inner_pre + "#" + sens_desc);
        d3.select("#frame_" + sens_id).remove();
        removeInArray(openedGraph1, sens_id);
    }
}

function removeInArray(array) {
    let what, a = arguments, L = a.length, ax;
    while (L > 1 && array.length) {
        what = a[--L];
        while ((ax = array.indexOf(what)) !== -1) {
            array.splice(ax, 1);
        }
    }
    return array;
}


function switchTo(element) {
    const custom_select = d3.select("#custom-select");
    custom_select.select("select").property("value", element.id.substring(12));
    user_selected_value = element.id.substring(12);
    // console.log(element.id.substring(12));
    // console.log(user_selected_value);
    if (user_selected_value === "Noise") {
        custom_select.select(".select-selected").select("span").attr("id", "noise_option");
    } else {
        custom_select.select(".select-selected").select("span").attr("id", null);
    }
    custom_select.select(".select-selected").attr("class", null);
    // console.log(element);
    element.setAttribute("class", "select-selected");
    reloadMap(user_selected_value);
}

function countrySelector() {
    console.log(this);
    d3.select(".countryButtonselected").attr('class', 'countryButton');
    d3.select(this).attr('class', 'countryButtonselected')
    // console.log(this.value);

    map.setView(places[this.value], zooms[this.value]);
    closeSidebar();
}