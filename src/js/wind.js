import 'whatwg-fetch'
import 'leaflet-velocity'
import checkStatus from './utils'

let dataRetrieved = false

async function fetchAndAddWindData(URL, map, switchLayer) {
    try {
        const response = await fetch(URL);
        checkStatus(response);
        const data = await response.json();
        L.velocityLayer({
            displayValues: false,
            displayOptions: false,
            data,
            velocityScale: 0.015,
            colorScale: ["#71C3F2", "#447591"],
            minVelocity: 1,
            maxVelocity: 10,
            overlayName: 'wind_layer',
            onAdd: switchLayer,
        }).addTo(map);
        dataRetrieved = true;
    } catch (error) {
        console.log('request failed', error);
    }
}

let wind = {
    getData: function (URL, map, switchLayer) {
        if (!dataRetrieved) {
            fetchAndAddWindData(URL, map, switchLayer);
        }
    }
}
export default wind;