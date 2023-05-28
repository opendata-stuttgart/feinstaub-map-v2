import 'whatwg-fetch';

let dataRetrieved = false;

const stations = {
  getData: async function (URL) {
    return fetch(URL)
      .then((resp) => resp.json())
      .then((geojson) => ({ cells: geojson }));
  }
};

export default stations;