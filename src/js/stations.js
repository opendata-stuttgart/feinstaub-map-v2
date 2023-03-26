import 'whatwg-fetch'

let stations = {
    getData: async function (URL) {

    return await fetch(URL)
    .then((resp) => resp.json())
    .then((geojson) => {
        return Promise.resolve({cells: geojson});
    })
    }
}
export default stations