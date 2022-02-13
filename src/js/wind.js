import 'whatwg-fetch'
import 'leaflet-velocity'
import checkStatus from './utils'

let wind = {
    getData: async function (URL, map, switchLayer) {
        // check if json has already been retrieved
        fetch(URL)
            .then(checkStatus)
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
            })
            .catch(function (error) {
                console.log('request failed', error)
            })
    }
}

export default wind