import _ from "lodash";
import "whatwg-fetch";

let api2 = {
  getData: async function (URL) {
    // function getRightValue(array, type) {
    //   let value;
    //   array.forEach((item) =>
    //     item.value_type === type ? (value = item.value) : null
    //   );
    //   return value;
    // }

    return await fetch(URL)
      .then((resp) => resp.json())
      .then((data) => {
        console.log(data);
        let cells =_.chain(data)
        return Promise.resolve({cells:cells});
      })
      .catch(function (error) {
        // If there is any error you will catch them here
        throw new Error(`Problems fetching data ${error}`);
      });
  },
};

export default api2;
