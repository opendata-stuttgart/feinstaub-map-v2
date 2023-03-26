import 'whatwg-fetch'
import checkStatus from './utils'

let dataRetrieved = false

let labs = {
    getData: async function (URL, map) {
        let labelBaseOptions = {
            iconUrl: 'images/labMarker.svg',
            shadowUrl: null,
            iconSize: new L.Point(21, 35),
            iconAnchor: new L.Point(10, 34),
            labelAnchor: new L.Point(25, 2),
            wrapperAnchor: new L.Point(10, 35),
            popupAnchor: [-0, -35]
        };

        let labelRight = L.Icon.extend({
            options: labelBaseOptions
        });
        
        if (!dataRetrieved) {
            fetch(URL)
                .then(checkStatus)
                .then((response) => response.json())
                .then((data) => {
                    for (var i = 0; i < data.length; i++) {
                        var lab_popuptext = "<b>" + data[i].title + "</b><br/><br/>";
                        if (typeof data[i].meetings != 'undefined') {
                            lab_popuptext += "<b>";
                            if (typeof data[i].meetings_title != 'undefined') {
                                lab_popuptext += data[i].meetings_title;
                            } else {
                                lab_popuptext += "Meetings";
                            }
                            lab_popuptext += "<br /></b>";
                            data[i].meetings.forEach(function (meeting) {
                                lab_popuptext += meeting.text + "<br />";
                            });
                            lab_popuptext += "<br />";
                        }
                        if (typeof data[i].contacts != 'undefined') {
                            lab_popuptext += "<b>";
                            if (typeof data[i].contacts_title != 'undefined') {
                                lab_popuptext += data[i].contacts_title;
                            } else {
                                lab_popuptext += "Contacts";
                            }
                            lab_popuptext += "<br /></b>";
                            data[i].contacts.forEach(function (contact) {
                                lab_popuptext += "<a href=\"" + contact.url + "\">" + contact.name + "</a><br />";
                            });
                            lab_popuptext += "<br />";
                        }
                        if (typeof data[i].website != 'undefined') {
                            lab_popuptext += "<b>Website</b><br/>";
                            lab_popuptext += "<a href='" + data[i].website + "' target='_blank' rel='noreferrer'>" + data[i].website + "</a><br /><br />";
                        }
                        lab_popuptext += "<table class='labs_sociallinks' style='width: auto;margin-left:0;'>";
                        if (typeof data[i].facebook != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/" + data[i].website + "' target='_blank' rel='noreferrer'>" + data[i].facebook + "</a></td></tr>";
                        }
                        if (typeof data[i].facebook_group != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/groups/" + data[i].facebook_group + "' target='_blank' rel='noreferrer'>" + data[i].facebook_group + "</a></td></tr>";
                        }
                        if (typeof data[i].facebook_page != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/" + data[i].facebook_page + "' target='_blank' rel='noreferrer'>" + data[i].facebook_page + "</a></td></tr>";
                        }
                        if (typeof data[i].twitter != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_twitter'></td><td><a href='https://twitter.com/" + data[i].twitter + "' target='_blank' rel='noreferrer'>@" + data[i].twitter + "</a></td></tr>";
                        }
                        if (typeof data[i].github != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_github'></td><td><a href='https://github.com/" + data[i].github + "' target='_blank' rel='noreferrer'>" + data[i].github + "</a></td></tr>";
                        }
                        if (typeof data[i].gitlab != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_gitlab'></td><td><a href='https://gitlab.com/" + data[i].gitlab + "' target='_blank' rel='noreferrer'>" + data[i].gitlab + "</a></td></tr>";
                        }
                        if (typeof data[i].github != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_mastodon'></td><td><a href='" + data[i].mastodon + "' target='_blank' rel='noreferrer'>" + data[i].mastodon + "</a></td></tr>";
                        }
                        if (typeof data[i].meetup != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_meetup'></td><td><a href='https://www.meetup.com/" + data[i].meetup + "' target='_blank' rel='noreferrer'>" + data[i].meetup + "</a></td><tr>";
                        }
                        if (typeof data[i].telegram != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_telegram'></td><td><a href='https://t.me/" + data[i].telegram + "' target='_blank' rel='noreferrer'>@" + data[i].telegram + "</a></td></tr>";
                        }
                        if (typeof data[i].telegram_group != 'undefined') {
                            lab_popuptext += "<tr><td class='labsSocialIcon labs_telegram'></td><td><a href='https://t.me/" + data[i].telegram_group + "' target='_blank' rel='noreferrer'>" + data[i].telegram_group + "</a></td></tr>";
                        }
                        lab_popuptext += "</table>";
                        lab_popuptext += "<br />Your location is missing? Add it <a href='https://github.com/opendata-stuttgart/luftdaten-local-labs' target='_blank' rel='noreferrer'>here</a>."
                        L.marker([data[i].lat, data[i].lon], {
                            icon: new labelRight(), riseOnHover: true, pane: 'markerPane1'
                        })
                            .bindPopup(lab_popuptext)
                            .addTo(map);
                    }
                })
                .then(() => dataRetrieved = true)
                .catch(function (error) {
                    console.log('request failed', error)
                })
        }
    }
}
export default labs