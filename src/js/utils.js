const utils = {
  checkStatus(response) {
    return response.ok ? response : Promise.reject(`An error has occurred: ${response.status}`);
  }
};

export default utils;