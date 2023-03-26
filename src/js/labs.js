import 'whatwg-fetch';

let dataRetrieved = false;

const createPopupText = (item, itemType) => {
    const title = item.title || '';
    const meetings = item.meetings || [];
    const contacts = item.contacts || [];
    const website = item.website || '';
    const socialLinks = [
        {platform: 'facebook', url: 'https://www.facebook.com/', key: 'facebook'},
        {platform: 'facebook', url: 'https://www.facebook.com/groups/', key: 'facebook_group'},
        {platform: 'facebook', url: 'https://www.facebook.com/', key: 'facebook_page'},
        {platform: 'twitter', url: 'https://twitter.com/', key: 'twitter'},
        {platform: 'github', url: 'https://github.com/', key: 'github'},
        {platform: 'gitlab', url: 'https://gitlab.com/', key: 'gitlab'},
        {platform: 'mastodon', url: '', key: 'mastodon'},
        {platform: 'meetup', url: 'https://www.meetup.com/', key: 'meetup'},
        {platform: 'telegram', url: 'https://t.me/', key: 'telegram'},
        {platform: 'telegram', url: 'https://t.me/', key: 'telegram_group'},
    ];

    let popupText = `<b>${title}</b><br/><br/>`;

    if (meetings.length) {
        const meetingsTitle = item.meetings_title || 'Meetings';
        popupText += `<b>${meetingsTitle}<br /></b>`;
        meetings.forEach((meeting) => {
            popupText += `${meeting.text}<br />`;
        });
        popupText += '<br />';
    }

    if (contacts.length) {
        const contactsTitle = item.contacts_title || 'Contacts';
        popupText += `<b>${contactsTitle}<br /></b>`;
        contacts.forEach((contact) => {
            popupText += `<a href="${contact.url}">${contact.name}</a><br />`;
        });
        popupText += '<br />';
    }

    if (website) {
        popupText += `<b>Website</b><br/><a href="${website}" target="_blank" rel="noreferrer">${website}</a><br /><br />`;
    }

    popupText += "<table class='labs_sociallinks' style='width: auto;margin-left:0;'>";
    socialLinks.forEach(({platform, url, key}) => {
        if (item[key]) {
            popupText += `<tr><td class='labsSocialIcon labs_${platform}'></td><td><a href='${url}${item[key]}' target='_blank' rel='noreferrer'>${item[key]}</a></td></tr>`;
        }
    });
    popupText += "</table>";
    popupText += "<br />Your location is missing? Add it <a href='https://github.com/opendata-stuttgart/luftdaten-local-labs' target='_blank' rel='noreferrer'>here</a>.";

    return popupText;
};

const labs = {
    getData: async function (URL, map) {
        const labelBaseOptions = {
            iconUrl: 'images/labMarker.svg',
            shadowUrl: null,
            iconSize: new L.Point(21, 35),
            iconAnchor: new L.Point(10, 34),
            labelAnchor: new L.Point(25, 2),
            wrapperAnchor: new L.Point(10, 35),
            popupAnchor: [-0, -35],
        };

        const labelRight = L.Icon.extend({
            options: labelBaseOptions,
        });
        if (!dataRetrieved) {
            fetch(URL)
                .then((response) => response.json())
                .then((data) => {
                    data.forEach((item) => {
                        const lab_popupText = createPopupText(item);
                        L.marker([item.lat, item.lon], {
                            icon: new labelRight(),
                            riseOnHover: true,
                            pane: 'markerPane1',
                        })
                            .bindPopup(lab_popupText)
                            .addTo(map);
                    });
                })
                .then(() => (dataRetrieved = true))
                .catch((error) => {
                    console.log('request failed', error);
                });
        }
    },
};

export default labs;