import 'whatwg-fetch'
import 'leaflet-velocity'
import checkStatus from './utils'

let wind = {

	getData: async function (URL, map, switchLayer) {

		fetch(URL)
			.then(checkStatus)
			.then((response) => response.json())
			.then((data) => {

				var velocityLayer = L.velocityLayer({
							displayValues: true,
							displayOptions: {
								velocityType: "Global Wind",
								displayPosition: "bottomleft",
								displayEmptyString: "No wind data"
							},
							data: data,
							velocityScale: 0.008,
							opacity: 0.5,
							colorScale: ["rgb(120,120,255)","rgb(50,50,255)"],
							minVelocity: 0,
							maxVelocity: 10,
							overlayName: 'wind_layer',
							onAdd: switchLayer,
				})
				.addTo(map);

//				layerControl.addOverlay(velocityLayer, "Wind - Global");

			})
			.catch(function(error) {
				console.log('request failed', error)
			})
		}
	}

export default wind
