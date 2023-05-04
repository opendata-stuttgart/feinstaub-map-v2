import 'whatwg-fetch';
import 'leaflet-velocity';

let dataRetrieved = false;

const wind = {
  getData: async function (URL, map, switchLayer) {
    if (!dataRetrieved) {
      try {
        const response = await fetch(URL);
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
  }
};

export default wind;