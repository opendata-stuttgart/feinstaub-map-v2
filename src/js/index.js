// import leaflet
import leaflet from 'leaflet';
import hash from 'leaflet-hash';
import 'leaflet/dist/leaflet.css';

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

import '../images/labMarker.svg';
import '../images/favicon.ico';
import '../css/style.css';
import {brussels} from "./places.js";

let hexagonheatmap, hmhexaPM_aktuell, hmhexaPM_AQI, hmhexa_t_h_p, hmhexa_noise, hmhexaPM_WHO, hmhexaPM_EU, hmhexaTempHumPress;

const lang = translate.getFirstBrowserLanguage().substring(0, 2); // save browser lanuage for translation
let openedGraph1 = [];
let timestamp_data = '';			// needs to be global to work over all 4 data streams
let timestamp_from = '';			// needs to be global to work over all 4 data streams
let clicked = null;
let user_selected_value = config.selection;
let coordsCenter = config.initialView;
let zoomLevel = config.initialZoom;
const locale = timeFormatLocale(config.locale);
const map = L.map("map", {preferCanvas: true, zoomControl: false, controls: false}).setView(config.initialView, config.initialZoom);

config.tiles = config.tiles_server + config.tiles_path;
L.tileLayer(config.tiles, {
    maxZoom: config.maxZoom, minZoom: config.minZoom, subdomains: config.tiles_subdomains
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

d3.select('#loading').html(translate.tr(lang, 'Loading data...'));

// read zoom level and coordinates query parameter from URL
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
    // translate elements
    d3.select("#menu").on("click", toggleMenu);

    d3.select("#world").html(translate.tr(lang, "World"));
    d3.select("#europe").html(translate.tr(lang, "Europe"));
    d3.select("#northamerica").html(translate.tr(lang, "North America"));
    d3.select("#southamerica").html(translate.tr(lang, "South America"));
    d3.select("#asia").html(translate.tr(lang, "Asia"));
    d3.select("#africa").html(translate.tr(lang, "Africa"));
    d3.select("#oceania").html(translate.tr(lang, "Oceania"));

    d3.selectAll(".selectCountry").selectAll("button").on("click", countrySelector);

    L.HexbinLayer = L.Layer.extend({
        _undef(a) {
            return typeof a === 'undefined';
        }, options: {
            radius: 25, opacity: 0.6, duration: 200, onmouseover: undefined, onmouseout: undefined, attribution: config.attribution, click: function (d) {
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
            let join = g.selectAll('path.hexbin-hexagon').data(bins);

            // Update - set the fill and opacity on a transition (opacity is re-applied in case the enter transition was cancelled)
            join.transition().duration(this.options.duration)
                .attr('fill', (d) => typeof this.options.value(d) === 'undefined' ? '#808080' : this._colorScale(this.options.value(d)))
                .attr('fill-opacity', this.options.opacity)
                .attr('stroke-opacity', this.options.opacity);

            // Enter - establish the path, the fill, and the initial opacity
            join.enter().append('path').attr('class', 'hexbin-hexagon')
                .attr('d', (d) => 'M' + d.x + ',' + d.y + hexbin.hexagon())
                .attr('fill', (d) => typeof this.options.value(d) === 'undefined' ? '#808080' : this._colorScale(this.options.value(d)))
                .on('mouseover', this.options.mouseover)
                .on('mouseout', this.options.mouseout)
                .on('click', this.options.click)
                .transition().duration(this.options.duration)
                .attr('fill-opacity', this.options.opacity)
                .attr('stroke-opacity', this.options.opacity);

            // Exit
            join.exit()
                .transition().duration(this.options.duration)
                .attr('fill-opacity', this.options.opacity)
                .attr('stroke-opacity', this.options.opacity)
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

    map.setView(coordsCenter, zoomLevel);
    map.clicked = 0;
    hexagonheatmap = L.hexbinLayer(config.scale_options[user_selected_value]).addTo(map);

    //retrieve data from api
    // pmDefault = PM10 PM25 5 min
    // aqi = AQI US
    // tempHumPress = Temperature Humidity Pressure
    // noise = Noise
    // pmWHO = PM10who PM25who
    // pmEU = PM10eu PM25eu
    function retrieveData(user_selected_value) {
        // Todo: load data only when user calls for it
        if (["PM25who", "PM10who"].includes(user_selected_value)) {
            api.getData(config.data_host + "/data/v2/data.24h.json", 'pmWHO').then(function (result) {
                hmhexaPM_WHO = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready("pmWHO");
            });
        }
        if (["PM25eu", "PM10eu"].includes(user_selected_value)) {
            api.getData(config.data_host + "/data/v2/data.24h.json", 'pmEU').then(function (result) {
                hmhexaPM_EU = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready("pmEU");
            });
        }
        if (user_selected_value === "AQIus") {
            api.getData(config.data_host + "/data/v2/data.24h.json", 'aqi').then(function (result) {
                hmhexaPM_AQI = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready("aqi");
            });
        }
        if (["Temperature", "Humidity", "Pressure"].includes(user_selected_value)) {
            api.getData(config.data_host + "/data/v2/data.temp.min.json", 'tempHumPress').then(function (result) {
                hmhexa_t_h_p = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready("tempHumPress");
            });
        }
        if (user_selected_value === "Noise") {
            api.getData(config.data_host + "/data/v1/data.noise.json", 'noise').then(function (result) {
                hmhexa_noise = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready("noise");
            });
        } else {
            api.getData(config.data_host + "/data/v2/data.dust.min.json", 'pmDefault').then(function (result) {
                hmhexaPM_aktuell = result.cells;
                if (result.timestamp > timestamp_data) {
                    timestamp_data = result.timestamp;
                    timestamp_from = result.timestamp_from;
                }
                ready("pmDefault");
            });
        }
    }

    retrieveData();

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

    function countrySelector() {
        d3.select(".countrySelected").attr('class', 'countryButton');
        d3.select(this).attr('class', 'countrySelected')
        map.setView(places[this.value], zooms[this.value]);
    }

    function switchLabLayer() {
        if (d3.select("#cb_labs").property("checked")) {
            map.getPane('markerPane').style.visibility = "visible";
            labs.getData(config.data_host + "/local-labs/labs.json", map);
        } else {
            map.getPane('markerPane').style.visibility = "hidden";
        }
        // document.getElementById("modal").style.display = "none";
        // d3.select("#menu").html(d3.select(".selected").select("span").html());
    }

    function switchWindLayer() {
        if (d3.select("#cb_wind").property("checked")) {
            d3.selectAll(".velocity-overlay").style("visibility", "visible");
            wind.getData(config.data_host + "/data/v1/wind.json", map, switchWindLayer);
        } else {
            d3.selectAll(".velocity-overlay").style("visibility", "hidden");
        }
        // document.getElementById("modal").style.display = "none"; // ???
        // d3.select("#menu").html(d3.select(".selected").select("span").html()); // ???
    }

    function switchLegend(val) {
        d3.select('#legend').selectAll("[id^=legend_]").style("display", "none");
        d3.select('#legend_' + val).style("display", "block");
    }

    function openMenu() {
        document.getElementById("menu").innerHTML = "&#10006;";
        document.getElementById("modal").style.display = "block";
        document.getElementById("mainContainer").style.display = "block";
    }

    function closeMenu() {
        document.getElementById("modal").style.display = "none";
        document.getElementById("mainContainer").style.display = "none";
        d3.select("#results").remove()
        closeExplanation()
    }

    function toggleMenu() {
        (document.getElementById("modal").style.display === "block") ? closeMenu() : openMenu();
    }

    function openExplanation() {
        document.getElementById("map-info").style.display = "block";
        d3.select("#explanation").html(translate.tr(lang, "Hide"));
    }

    function closeExplanation() {
        document.getElementById("map-info").style.display = "none";
        d3.select("#explanation").html(translate.tr(lang, "Explanation"));
    }

    function toggleExplanation() {
        (document.getElementById("map-info").style.display === "block") ? closeExplanation() : openExplanation();
    }

    function ready(vizType) {
        const dateParser = timeParse("%Y-%m-%d %H:%M:%S");
        const timestamp = dateParser(timestamp_data);
        const localTime = new Date();
        const timeOffset = localTime.getTimezoneOffset();
        const newTime = timeMinute.offset(timestamp, -(timeOffset));
        const dateFormater = locale.format("%d.%m.%Y %H:%M");

        d3.select("#lastUpdate").html(translate.tr(lang, "Last update") + " " + dateFormater(newTime));
        d3.select("#menu").html(d3.select(".selected").select("span").html());

        if (vizType === "pmWHO" && (user_selected_value === "PM10who" || user_selected_value === "PM25who")) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_WHO);
        }
        if (vizType === "aqi" && user_selected_value === "AQIus") {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_AQI);
        }
        if (vizType === "TempHumPress" && (user_selected_value === "Temperature" || user_selected_value === "Humidity" || user_selected_value === "Pressure")) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexa_t_h_p.filter(function (value) {
                return api.checkValues(value.data[user_selected_value], user_selected_value);
            }));
        }
        if (vizType === "Noise" && user_selected_value === "Noise") {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexa_noise);
        } else {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_aktuell);
        }
        d3.select("#loading").style("display", "none");
    }

    function reloadMap(val) {
        d3.selectAll('path.hexbin-hexagon').remove();
        switchLegend(val);

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
            hexagonheatmap.data(hmhexa_t_h_p.filter(function (value) {
                return api.checkValues(value.data[user_selected_value], user_selected_value);
            }));
        } else if (val === "Noise") {
            hexagonheatmap.data(hmhexa_noise);
        }
    }

    function sensorNr(data) {
        // no graphs for AQI :(
        openMenu()

        document.getElementById("mainContainer").style.display = "none"; // hide menu content
        let textefin = "<table id='results' style='width:95%;'><tr><th class ='title'>" + translate.tr(lang, 'Sensor') + "</th><th class = 'title'>" + translate.tr(lang, config.titles[user_selected_value]) + "</th></tr>";
        1
        if (data.length > 1) {
            textefin += "<tr><td class='idsens'>Median " + data.length + " Sens.</td><td>" + (isNaN(parseInt(data_median(data))) ? "-" : parseInt(data_median(data))) + "</td></tr>";
        }
        let sensors = '';
        data.forEach(function (i) {
            sensors += "<tr><td class='idsens' id='id_" + i.o.id + (i.o.indoor ? "_indoor" : "") + "'> #" + i.o.id + (i.o.indoor ? " (indoor)" : "") + "</td>";
            if (["PM10", "PM25", "PM10eu", "PM25eu", "PM10who", "PM25who", "Temperature", "Humidity", "Noise"].includes(user_selected_value)) {
                sensors += "<td>" + i.o.data[user_selected_value] + "</td></tr>";
            }
            if (user_selected_value === "AQIus") {
                sensors += "<td>" + i.o.data[user_selected_value] + " (" + i.o.data.origin + ")</td></tr>";
            }
            if (user_selected_value === "Pressure") {
                sensors += "<td>" + i.o.data[user_selected_value].toFixed(1) + "</td></tr>";
            }
            sensors += "<tr id='graph_" + i.o.id + "'></tr>";
        });
        textefin += sensors;
        textefin += "</table>";
        d3.select("#table").html(textefin)
        d3.selectAll(".idsens").on("click", function () {
            displayGraph(d3.select(this).attr("id"));
        });
    }

    async function displayGraph(id) {
        const panel_str = "<iframe src='https://maps.sensor.community/grafana/d-solo/000000004/single-sensor-view?orgId=1&panelId=<PANELID>&var-node=<SENSOR>' frameborder='0' height='300px' width='100%'></iframe>";
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

            d3.select("#id_" + sens).html("(-) #" + sens_desc);
        } else {
            d3.select("#id_" + sens).html("(+) #" + sens_desc);
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
        user_selected_value = element.getAttribute('value')
        /*    if (user_selected_value === "Noise") {
            custom_select.select(".selected").select("span").attr("id", "noise_option");
        } else {
            custom_select.select(".selected").select("span").attr("id", null);
        }*/
        retrieveData(user_selected_value)
        custom_select.select(".selected").attr("class", null); // remove class selected
        element.setAttribute("class", "selected");
        closeMenu();
        setTimeout(function () {
            reloadMap(user_selected_value);
        }, 1500);
    }

    // Todo: remove select-items because it duplicates the data
    const custom_select = d3.select("#custom-select");
    custom_select.append("div").attr("class", "select-items");
    custom_select.select("select").selectAll("option").each(function () {
        // Todo: get rid of span
        custom_select.select(".select-items").append("div").html("<span>" + d3.select(this).html() + "</span>").attr("id", "select-item-" + this.value).attr("value", this.value).on("click", function () {
            switchTo(this);
        });
    });
    d3.select(".select-items").selectAll("div").each(function () {
        if (this.getAttribute('value') === custom_select.select("select").select("option:checked").node().value) {
            this.setAttribute("class", "selected");
        }
    });

    // Load lab and windlayer, init checkboxes
    d3.select("#cb_labs").property("checked", false);
    d3.select("#cb_wind").property("checked", false);

    d3.select("#label_local_labs").html(translate.tr(lang, "Local labs"));
    d3.select("#label_wind_layer").html(translate.tr(lang, "Wind layer"));

    d3.select("#cb_labs").on("change", switchLabLayer);
    d3.select("#cb_wind").on("change", switchWindLayer);

    // translate AQI values
    d3.select("#AQI_Good").html(" " + translate.tr(lang, "Good"));
    d3.select("#AQI_Moderate").html(" " + translate.tr(lang, "Moderate"));
    d3.select("#AQI_Unhealthy_Sensitive").html(" " + translate.tr(lang, "Unhealthy for sensitive"));
    d3.select("#AQI_Unhealthy").html(" " + translate.tr(lang, "Unhealthy"));
    d3.select("#AQI_Very_Unhealthy").html(" " + translate.tr(lang, "Very Unhealthy"));
    d3.select("#AQI_Hazardous").html(" " + translate.tr(lang, "Hazardous"));

    // translate menu links
    d3.select("#website").html(translate.tr(lang, "Website"));
    d3.select("#forum").html(translate.tr(lang, "Forum"));
    d3.select("#explanation").on("click", toggleExplanation).html(translate.tr(lang, 'Explanation'));

    d3.select('#map-info').html(translate.tr(lang, "<p>The hexagons represent the median of the current sensor values included in this area, depending on you selected option (PM2.5, temperature,...).</p> \
<p>A hexagon will display a list of the corresponding sensors as a table. The first row will show you the amount of sensor and the median value.</p> \
<p>The plus symbol will display <i>individual measurements of the last 24 hours</i> and a <i>24 hours moving average for the last seven days</i>. </br> Due to technical reasons, the first day is blank.</p> \
<p>Map values are <strong>refreshed every 5 minutes</strong> to fit with the measurement frequency of the multiple airRohr sensors.</p>"));

    // refresh data every 5 minutes
    setInterval(function () {
        d3.selectAll('path.hexbin-hexagon').remove();
        retrieveData();
    }, 300000);

    switchLegend(user_selected_value);
}