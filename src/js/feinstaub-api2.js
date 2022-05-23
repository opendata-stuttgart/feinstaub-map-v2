import _ from 'lodash'
import 'whatwg-fetch'

let api2 = {

	getData: async function (URL) {

		return fetch(URL)
			.then((resp) => resp.json())
			.then((json) => {
				console.log('successful retrieved data');
					let cells = _.chain(json)
						.map((values) => {
							return {"type":"Feature","properties":{"id":values.sensor.id,"indoor":values.location.indoor,"type":values.sensor.sensor_type.name},"geometry":{"type":"Point","coordinates":[values.location.longitude,values.location.latitude]}}})
						.value();
//					return Promise.resolve({cells: cells});    
        return Promise.resolve({"type":"FeatureCollection","features":cells});            
			}).catch(function (error) {
				throw new Error(`Problems fetching data ${error}`)
			});
	}
};

export default api2
