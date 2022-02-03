# Sensor.Community Map
visualize recent sensor data on a world map for [Sensor.Community](https://sensor.community).
 
👉 [Live Version](https://maps.sensor.community/).

# Map application
The implementation makes use of various frameworks and is on [ECMA 6](https://developer.mozilla.org/de/docs/Web/JavaScript) language level. 

Used frameworks are:
* [leaflet](http://leafletjs.com/) (mapping framework)
* [d3](https://d3js.org/) (visualisation framework)
* [webpack](https://webpack.github.io/) is used for deployment

# How to run
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
build all files needed to run on a webserver, files will be compiled into `dist/`):

```
npm run build
npm run ghpages
```

# Translation

The translation file can be found in `src/js/translation.js`. 

To add a new translated word or sentence, add below the key (see below) a new _key-value pair_. 
The nested key should start with the iso-code of the language followed by the translated world.
You can find the iso-code on [wikipedia table (639-1)](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).

```javascript
   "(Sensor)": { // key - original english translation 
      "de": "Sensor", // nested key - value pair
      "fr": "Détecteur" // add new translation "iso-code": "translated word"
   },
    "PM10 &micro;g/m&sup3;": {},
    "PM2.5 &micro;g/m&sup3;": {},
    "AQI US": {},
    "Temperature °C": { // key - original english translation 
       "de": "Temperatur °C",
       "fr": "Température °C" // add new translation "iso-code": "translated word"
       },...
```

⚠ Don't forget to add the comma in the previous _key - value pair_ else syntax is broken.

If you don't have a Github account download the file `src/js/translation.js` via the `Raw` button directly right
over the source code. Send us your file with the translation to "tech (at) sensor.community".

## URL-Parameter

### Sensor 
valid sensor parameters PM25, PM10, Pressure, Noise, Humidity & Official_AQI_US 
http://127.0.0.1:8080/?sensor=Noise

### Location 
valid parameters zoom level, lat and long 
http://127.0.0.1:8080/#9/48.8123/9.2487

### Layer Wind and Labs
valid sensor parameters layer_wind and/or layer_labs, this will prevent showing one of those layers
http://127.0.0.1:8080/?layer_labs

### combine parameters
first start with sensor, then layers and finally location
http://127.0.0.1:8080/?sensor=Noise&layer_wind=false#3/48.8123/9.2487

