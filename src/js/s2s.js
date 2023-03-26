import 'whatwg-fetch';

let dataRetrieved = false;

/* TODO: This is a copy of the labs.js code. It should be refactored to use a common function. */

const labelBaseOptions = {
    iconUrl: 'images/schoolMarker.svg',
    shadowUrl: null,
    iconSize: new L.Point(21, 35),
    iconAnchor: new L.Point(10, 34),
    labelAnchor: new L.Point(25, 2),
    wrapperAnchor: new L.Point(10, 35),
    popupAnchor: [-0, -35]
};

const labelRight = L.Icon.extend({
    options: labelBaseOptions
});

async function getData(URL, map) {
    if (!dataRetrieved) {
        try {
            const response = await fetch(URL);
            const data = await response.json();

            data.forEach((item) => {
                let school_popuptext = `<h3>${item.title}</h3><br/>`;
                if (item.contacts) {
                    school_popuptext += `<b>${item.contacts_title || 'Contacts'}<br /></b>`;
                    item.contacts.forEach((contact) => {
                        school_popuptext += `<a href="${contact.url}">${contact.name}</a><br />`;
                    });
                    school_popuptext += "<br />";
                }
                if (item.partner) {
                    school_popuptext += `<b>${item.partner_title || 'Partner'}<br /></b>`;
                    item.partner.forEach((partner) => {
                        school_popuptext += `<a href="${partner.url}">${partner.name}</a><br />`;
                    });
                    school_popuptext += "<br />";
                }
                if (item.website) {
                    school_popuptext += `<b>Website</b><br/><a href='${item.website}' target='_blank' rel='noreferrer'>${item.website}</a><br />`;
                }
                if (item.facebook_page) {
                    school_popuptext += `<b>Facebook</b><br/><a href='https://www.facebook.com/${item.facebook_page}' target='_blank' rel='noreferrer'>${item.facebook_page}</a>`;
                }

                L.marker([item.lat, item.lon], {
                    icon: new labelRight(), riseOnHover: true, pane: 'markerPane2'
                })
                    .bindPopup(school_popuptext)
                    .addTo(map);
            });

            dataRetrieved = true;
        } catch (error) {
            console.log('request failed', error);
        }
    }
}

export default { getData };