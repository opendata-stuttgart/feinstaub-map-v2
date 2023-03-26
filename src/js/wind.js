import 'whatwg-fetch'
import 'leaflet-velocity'

let dataRetrieved = false

let wind = {
    getData: async function (URL, map, switchLayer) {
        // check if json has already been retrieved
        if (!dataRetrieved) {
            fetch(URL)
                .then((response) => response.json())
                .then((data) => {
                    L.velocityLayer({
                        displayValues: false,
                        displayOptions: false,
                        data: data,
                        velocityScale: 0.015,
                        colorScale: ["#71C3F2", "#447591"],
                        minVelocity: 1,
                        maxVelocity: 10,
                        overlayName: 'wind_layer',
                        onAdd: switchLayer,
                    }).addTo(map);
                }).then(() => dataRetrieved = true)
                .catch(function (error) {
                    console.log('request failed', error)
                })
        }
    }
}

export default wind