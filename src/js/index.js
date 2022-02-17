// import leaflet
import leaflet from 'leaflet';
import hash from 'leaflet-hash';
import * as GeoSearch from 'leaflet-geosearch';
import * as L from 'leaflet';
import 'leaflet-geosearch/dist/geosearch.css';

// d3 libraries
import * as d3_Hexbin from "d3-hexbin";
import * as d3_Selection from 'd3-selection';
import * as d3_Transition from "d3-transition";
import {scaleLinear} from 'd3-scale';
import {geoPath, geoTransform} from 'd3-geo';
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
import '../css/leaflet.css';

let hexagonheatmap, hmhexaPM_aktuell, hmhexaPM_AQI, hmhexa_t_h_p, hmhexa_noise, hmhexaPM_WHO, hmhexaPM_EU;

const lang = translate.getFirstBrowserLanguage().substring(0, 2); // save browser lanuage for translation
let openedGraph1 = [];
let timestamp_data = '';			// needs to be global to work over all 4 data streams
let timestamp_from = '';			// needs to be global to work over all 4 data streams
let clicked = null;
let user_selected_value = config.sensor;
let coordsCenter = config.initialView;
let zoomLevel = config.initialZoom;
const locale = timeFormatLocale(config.locale);
const map = L.map("map", {preferCanvas: true, zoomControl: false, controls: false}).setView(config.initialView, config.initialZoom);
let windLayerRetrieved = false
let labsLayerRetrieved = false

config.tiles = config.tiles_server + config.tiles_path;
L.tileLayer(config.tiles, {
    maxZoom: config.maxZoom, minZoom: config.minZoom, subdomains: config.tiles_subdomains
}).addTo(map);
// Adds query and hash parameter to the current URL
new L.Hash(map);

// iife function to read query parameter from URL
(function () {
    let query_value;
    const search_values = location.search.replace('\?', '').split('&');
    for (let i = 0; i < search_values.length; i++) {
        query_value = search_values[i].split('=');
        (typeof query_value[0] != 'sensor' && undefined) ? user_selected_value = query_value[1] : user_selected_value = config.sensor;
    }
})();

document.querySelector('#loading').innerText = translate.tr(lang, 'Loading data...')

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
    L.HexbinLayer = L.Layer.extend({
        _undef(a) {
            return typeof a === 'undefined';
        }, options: {
            radius: 25, opacity: 0.6, duration: 200, attribution: config.attribution, click: function (d) {
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
            // Todo: get rid of d3.select and use vanilla js instead
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
        }, addTo(map) {
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
    async function retrieveData(user_selected_value) {
        await api.getData(config.data_host + "/data/v2/data.dust.min.json", 'pmDefault').then(function (result) {
            hmhexaPM_aktuell = result.cells;
            if (result.timestamp > timestamp_data) {
                timestamp_data = result.timestamp;
                timestamp_from = result.timestamp_from;
            }
        }).then(() => ready("pmDefault"))

        await api.getData(config.data_host + "/data/v2/data.24h.json").then(function (result) {
            hmhexaPM_WHO = result.cells;
            hmhexaPM_EU = result.cells;
            hmhexaPM_AQI = result.cells;

            if (result.timestamp > timestamp_data) {
                timestamp_data = result.timestamp;
                timestamp_from = result.timestamp_from;
            }
        }).then(function () {
            ready("pmWHO")
            ready("pmEU")
            ready("aqi")
        })

        await api.getData(config.data_host + "/data/v2/data.temp.min.json", 'tempHumPress').then(function (result) {
            hmhexa_t_h_p = result.cells;
            if (result.timestamp > timestamp_data) {
                timestamp_data = result.timestamp;
                timestamp_from = result.timestamp_from;
            }
        }).then(() => ready("tempHumPress"))

        await api.getData(config.data_host + "/data/v1/data.noise.json", 'noise').then(function (result) {
            hmhexa_noise = result.cells;
            if (result.timestamp > timestamp_data) {
                timestamp_data = result.timestamp;
                timestamp_from = result.timestamp_from;
            }
        }).then(() => ready("noise"))
    }

    function ready(vizType) {
        const date = new Date()
        const dateParser = timeParse("%Y-%m-%d %H:%M:%S");
        const getOffsetHours = date.getTimezoneOffset() * 60000
        const logTimestamp = dateParser(timestamp_data).getTime()
        const lastUpdateTimestamp = logTimestamp + (-getOffsetHours)
        const dateFormater = locale.format("%d.%m.%Y %H:%M:%S");

        document.querySelector("#lastUpdate").innerText = translate.tr(lang, "Last update") + " " + dateFormater(lastUpdateTimestamp);
        document.querySelector("#menuButton").innerText = document.querySelector(".selected").innerText

        if (vizType === "pmWHO" && (user_selected_value === "PM10who" || user_selected_value === "PM25who")) {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_WHO);
        }
        if (vizType === "aqi" && user_selected_value === "AQIus") {
            hexagonheatmap.initialize(config.scale_options[user_selected_value]);
            hexagonheatmap.data(hmhexaPM_AQI);
        }
        if (vizType === "tempHumPress" && ["Temperature", "Humidity", "Pressure"].includes(user_selected_value)) {
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
        document.querySelector("#loading").style.display = "none";
    }

    retrieveData()

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

    function reloadMap(val) {
        document.querySelectorAll('path.hexbin-hexagon').forEach(function (d) {
            d.remove();
        });
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
        switchLegend(val);
    }

    function sensorNr(data) {
        openMenu()

        document.getElementById("mainContainer").style.display = "none"; // hide menu content
        let textefin = "<table id='results' style='width:95%;'><tr><th class ='title'>" + translate.tr(lang, 'Sensor') + "</th><th class = 'title'>" + translate.tr(lang, config.tableTitles[user_selected_value]) + "</th></tr>";
        if (data.length > 1) {
            textefin += "<tr><td class='idsens'>Median " + data.length + " Sensors</td><td>" + (isNaN(parseInt(data_median(data))) ? "-" : parseInt(data_median(data))) + "</td></tr>";
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
        document.querySelector('#table').innerHTML = textefin;
        document.querySelectorAll('.idsens').forEach(function (d) {
            d.addEventListener('click', function () {
                displayGraph(this.id); // transfer id e.g. id_67849
            });
        });
    }

    async function displayGraph(id) {
        const panel_str = "<iframe src='https://maps.sensor.community/grafana/d-solo/000000004/single-sensor-view?orgId=1&panelId=<PANELID>&var-node=<SENSOR>' frameborder='0' height='300px' width='100%'></iframe>";
        const sens = id.substr(3);
        const sens_id = sens.replace("_indoor", "");
        const sens_desc = sens.replace("_indoor", " (indoor)");

        if (!openedGraph1.includes(sens_id)) {
            openedGraph1.push(sens_id);
            const iframeID = 'frame_' + sens_id
            document.querySelector("#graph_" + sens_id).appendChild(document.createElement('td')).setAttribute('id', iframeID);
            document.querySelector('#' + iframeID).setAttribute('colspan', '2')
            document.querySelector('#' + iframeID).innerHTML = ((config.panelIDs[user_selected_value][0] > 0 ? panel_str.replace("<PANELID>", config.panelIDs[user_selected_value][0]).replace("<SENSOR>", sens_id) + "<br/>" : "") + (config.panelIDs[user_selected_value][1] > 0 ? panel_str.replace("<PANELID>", config.panelIDs[user_selected_value][1]).replace("<SENSOR>", sens_id) : ""))

            document.querySelector("#id_" + sens).innerText = "(-) #" + sens_desc
        } else {
            document.querySelector("#id_" + sens).innerText = "(+) #" + sens_desc
            document.querySelector('#frame_' + sens_id).remove();
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

    function switchTo(user_selected_value) {
        let elem = document.querySelector(`div[value='${user_selected_value}']`)
        document.querySelector('.selected').classList.remove("selected"); // remove class selected
        elem.classList.add("selected");
        // https://javascript.info/async-await
        // https://t3n.de/news/javascript-zukunft-diese-neuen-1451816/?utm_source=rss&utm_medium=feed&utm_campaign=news
        reloadMap(user_selected_value)
        switchLegend(user_selected_value)
        closeMenu()
    }

    switchTo(user_selected_value)

    function countrySelector() {
        document.querySelector(".countrySelected").classList.remove("countrySelected")
        document.querySelector(`#${this.id}`).classList.add("countrySelected")
        map.setView(places[this.value], zooms[this.value]);
    }

    function switchLabLayer() {
        if (document.querySelector("#cb_labs").checked) {
            labs.getData(config.data_host + "/local-labs/labs.json", map);
            map.getPane('markerPane').style.visibility = "visible";
        } else {
            map.getPane('markerPane').style.visibility = "hidden";
        }
    }

    function switchWindLayer() {
        if (document.querySelector("#cb_wind").checked) {
            wind.getData(config.data_host + "/data/v1/wind.json", map, switchWindLayer);
            document.querySelectorAll(".velocity-overlay").forEach((d) => d.style.visibility = "visible");
        } else {
            document.querySelectorAll(".velocity-overlay").forEach((d) => d.style.visibility = "hidden");
        }
    }

    function switchLegend(val) {
        document.querySelectorAll('[id^=legend_]').forEach(d => d.style.display = "none");
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
        closeExplanation()
        document.querySelector("#menuButton").innerText = document.querySelector('.selected').innerText;
        (document.querySelector('#results')) ? document.querySelector('#results').remove() : null;
    }

    function toggleMenu() {
        (document.getElementById("modal").style.display === "block") ? closeMenu() : openMenu();
    }

    function openExplanation() {
        document.getElementById("map-info").style.display = "block";
        document.querySelector("#explanation").innerText = translate.tr(lang, "Hide")
    }

    function closeExplanation() {
        document.getElementById("map-info").style.display = "none";
        document.querySelector("#explanation").innerText = translate.tr(lang, "Explanation")
    }

    function toggleExplanation() {
        (document.getElementById("map-info").style.display === "block") ? closeExplanation() : openExplanation();
    }

    document.querySelector("#menuButton").onclick = toggleMenu;

    // Load lab and windlayer, init checkboxes
    document.querySelector("#cb_labs").checked = false;
    document.querySelector("#cb_wind").checked = false;

    document.querySelector("#label_local_labs").innerText = translate.tr(lang, "Local labs");
    document.querySelector("#label_wind_layer").innerText = translate.tr(lang, "Wind layer");

    document.querySelector("#cb_labs").addEventListener("change", switchLabLayer);
    document.querySelector("#cb_wind").addEventListener("change", switchWindLayer);

    // translate AQI values
    document.querySelector("#AQI_Good").innerText = translate.tr(lang, "Good");
    document.querySelector("#AQI_Moderate").innerText = translate.tr(lang, "Moderate");
    document.querySelector("#AQI_Unhealthy_Sensitive").innerText = translate.tr(lang, "Unhealthy for sensitive");
    document.querySelector("#AQI_Unhealthy").innerText = translate.tr(lang, "Unhealthy");
    document.querySelector("#AQI_Very_Unhealthy").innerText = translate.tr(lang, "Very Unhealthy");
    document.querySelector("#AQI_Hazardous").innerText = translate.tr(lang, "Hazardous");

    // translate menu links
    document.querySelector("#website").innerText = translate.tr(lang, "Website");
    document.querySelector("#forum").innerText = translate.tr(lang, "Forum");
    document.querySelector("#explanation").innerText = translate.tr(lang, "Explanation")
    document.querySelector("#explanation").addEventListener("click", toggleExplanation);
    document.querySelector('#map-info').innerHTML = translate.tr(lang, "<p>The hexagons represent the median of the current sensor values included in this area, depending on you selected option (PM2.5, temperature,...).</p> \
<p>A hexagon will display a list of the corresponding sensors as a table. The first row will show you the amount of sensor and the median value.</p> \
<p>The plus symbol will display <i>individual measurements of the last 24 hours</i> and a <i>24 hours moving average for the last seven days</i>. </br> Due to technical reasons, the first day is blank.</p> \
<p>Map values are <strong>refreshed every 5 minutes</strong> to fit with the measurement frequency of the multiple airRohr sensors.</p>");

// refresh data every 5 minutes
    setInterval(function () {
        document.querySelectorAll('path.hexbin-hexagon').forEach((e) => e.remove());
        windLayerRetrieved = labsLayerRetrieved = false
        retrieveData()
    }, 300000);

    // translate elements
    document.querySelector("#world").innerText = translate.tr(lang, "World")
    document.querySelector("#europe").innerText = translate.tr(lang, "Europe")
    document.querySelector("#northamerica").innerText = translate.tr(lang, "North America")
    document.querySelector("#southamerica").innerText = translate.tr(lang, "South America")
    document.querySelector("#asia").innerText = translate.tr(lang, "Asia")
    document.querySelector("#africa").innerText = translate.tr(lang, "Africa")
    document.querySelector("#oceania").innerText = translate.tr(lang, "Oceania")
    document.querySelector("#explanation").innerText = translate.tr(lang, "Explanation")

    document.querySelectorAll(".selectCountry button").forEach(d => d.addEventListener("click", countrySelector));

    document.querySelectorAll(".select-items div").forEach(function (d) {
        d.addEventListener("click", function () {
            user_selected_value = this.getAttribute('value')
            !(user_selected_value === document.querySelector(".selected").getAttribute("value")) && switchTo(user_selected_value)
        })
    });
    if (navigator.share) {
        document.querySelector("#share").addEventListener("click", function () {
            navigator.share({
                title: 'Maps.Sensor.Community',
                text: 'Maps is a free web app to monitor air quality in your area. You can find more information on Sensor.Community.',
                url: document.location.href
            })
        })
    } else {
        document.querySelector("#share").style.display = "none"
    }
}

// add searchbox
new GeoSearch.GeoSearchControl({
    style: 'bar', showMarker: false, provider: new GeoSearch.OpenStreetMapProvider(),
}).addTo(map);