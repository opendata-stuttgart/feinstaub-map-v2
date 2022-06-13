let utils = {
    checkStatus(response) {
        if (!response.ok) {
            const message = `An error has occured: ${response.status}`;
            throw new Error(message)
        } else {
            return response
        }
    },
};
export default utils