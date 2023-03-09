import _ from "lodash";
import "whatwg-fetch";

const api2 = {
  getData: async function (URL) {
    try {
      const resp = await fetch(URL);
      const data = await resp.json();
      const cells = _.chain(data);
      return { cells };
    } catch (error) {
      throw new Error(`Problems fetching data ${error}`);
    }
  },
};
export default api2;