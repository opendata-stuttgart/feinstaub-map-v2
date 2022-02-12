import 'whatwg-fetch'
import 'leaflet-velocity'
import checkStatus from './utils'

let jsonRetrieved = null

let wind = {
    getData: async function (URL, map, switchLayer) {
        // check if json has already been retrieved
        if (!jsonRetrieved) {
            fetch(URL)
                .then(checkStatus)
                .then((response) => response.json())
                .then((data) => {
                    L.velocityLayer({
                        displayValues: true,
                        displayOptions: false,
                        data: data,
                        velocityScale: 0.008,
                        opacity: 0.5,
                        colorScale: ["rgb(120,120,255)", "rgb(50,50,255)"],
                        minVelocity: 0,
                        maxVelocity: 10,
                        overlayName: 'wind_layer',
                        onAdd: switchLayer,
                    })
                        .addTo(map);
                })
                .then(() => {
                    jsonRetrieved = true
                })
                .catch(function (error) {
                    console.log('request failed', error)
                })
        }
    }
}

export default wind