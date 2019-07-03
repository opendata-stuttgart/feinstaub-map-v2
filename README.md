# Feinstaub Map
A new version of air quality map for the Luftdaten. 
You can find a here a [Live Version](https://maps.luftdaten.info/).

## Goals and ideas
* visualise recent sensor data on a map
* switch between sensor data (PM2.5, PM10, humidity data, ...)
* visualization between Air Quality Index (AQI) and normal default levels
* identify and add existing air quality data from external sources

### Map application
The implementation makes use of various frameworks and is on [ECMA 6](https://developer.mozilla.org/de/docs/Web/JavaScript) language level. Used frameworks are:
* [leaflet](http://leafletjs.com/) (mapping framework)
* [d3](https://d3js.org/) (visualisation framework)
* [webpack](https://webpack.github.io/) is used for deployment

## How to run
### Installation
Requirements:
* [Node JS](https://nodejs.org/) 10.15.x or higher
* NPM should be version 6.9.x or higher

install all dependencies
```
cp src/js/config.js.dist src/js/config.js
npm install
```

### Develop
start development server (http://127.0.0.1:8080/)
```
npm start
```

### Publish
build all files needed to run on a webserver, files willl be compileed into `dist/`):
```
npm run build
npm run ghpages
```
