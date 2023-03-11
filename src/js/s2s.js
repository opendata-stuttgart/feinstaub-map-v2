import 'whatwg-fetch'
import checkStatus from './utils'

let s2s = {
    getData: async function (data, map) {
        let labelBaseOptions = {
            iconUrl: 'images/schoolMarker.svg',
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
        
        console.log(data);


                    for (var i = 0; i < data.default.length; i++) {

                        console.log(data.default[i].title);

                        var school_popuptext = "<h3>" + data.default[i].title + "</h3><br/><br/>";
                        if (typeof data.default[i].contacts != 'undefined') {
                            school_popuptext += "<b>";
                            if (typeof data.default[i].contacts_title != 'undefined') {
                                school_popuptext += data.default[i].contacts_title;
                            } else {
                                school_popuptext += "Contacts";
                            }
                            school_popuptext += "<br /></b>";
                            data.default[i].contacts.forEach(function (contact) {
                                school_popuptext += "<a href=\"" + contact.url + "\">" + contact.name + "</a><br />";
                            });
                            school_popuptext += "<br />";
                        }
                        if (typeof data.default[i].partner != 'undefined') {
                            school_popuptext += "<b>";
                            if (typeof data.default[i].partner_title != 'undefined') {
                                school_popuptext += data.default[i].partner_title;
                            } else {
                                school_popuptext += "Partner";
                            }
                            school_popuptext += "<br /></b>";
                            data.default[i].partner.forEach(function (partner) {
                                school_popuptext += "<a href=\"" + partner.url + "\">" + partner.name + "</a><br />";
                            });
                            school_popuptext += "<br />";
                        }
                        if (typeof data.default[i].website != 'undefined') {
                            school_popuptext += "<b>Website</b><br/>";
                            school_popuptext += "<a href='" + data.default[i].website + "' target='_blank' rel='noreferrer'>" + data.default[i].website + "</a><br /><br />";
                        }
                        // school_popuptext += "<table class='labs_sociallinks' style='width: auto;margin-left:0;'>";
                        // if (typeof data[i].facebook != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/" + data[i].website + "' target='_blank' rel='noreferrer'>" + data[i].facebook + "</a></td></tr>";
                        // }
                        // if (typeof data[i].facebook_group != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/groups/" + data[i].facebook_group + "' target='_blank' rel='noreferrer'>" + data[i].facebook_group + "</a></td></tr>";
                        // }
                        if (typeof data.default[i].facebook_page != 'undefined') {
                            school_popuptext += "<b>Facebook</b><br/>";
                            school_popuptext += "<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/" + data.default[i].facebook_page + "' target='_blank' rel='noreferrer'>" + data.default[i].facebook_page + "</a></td></tr>";
                        }
                        // if (typeof data[i].twitter != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_twitter'></td><td><a href='https://twitter.com/" + data[i].twitter + "' target='_blank' rel='noreferrer'>@" + data[i].twitter + "</a></td></tr>";
                        // }
                        // if (typeof data[i].github != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_github'></td><td><a href='https://github.com/" + data[i].github + "' target='_blank' rel='noreferrer'>" + data[i].github + "</a></td></tr>";
                        // }
                        // if (typeof data[i].gitlab != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_gitlab'></td><td><a href='https://gitlab.com/" + data[i].gitlab + "' target='_blank' rel='noreferrer'>" + data[i].gitlab + "</a></td></tr>";
                        // }
                        // if (typeof data[i].github != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_mastodon'></td><td><a href='" + data[i].mastodon + "' target='_blank' rel='noreferrer'>" + data[i].mastodon + "</a></td></tr>";
                        // }
                        // if (typeof data[i].meetup != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_meetup'></td><td><a href='https://www.meetup.com/" + data[i].meetup + "' target='_blank' rel='noreferrer'>" + data[i].meetup + "</a></td><tr>";
                        // }
                        // if (typeof data[i].telegram != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_telegram'></td><td><a href='https://t.me/" + data[i].telegram + "' target='_blank' rel='noreferrer'>@" + data[i].telegram + "</a></td></tr>";
                        // }
                        // if (typeof data[i].telegram_group != 'undefined') {
                        //     school_popuptext += "<tr><td class='labsSocialIcon labs_telegram'></td><td><a href='https://t.me/" + data[i].telegram_group + "' target='_blank' rel='noreferrer'>" + data[i].telegram_group + "</a></td></tr>";
                        // }
                        // school_popuptext += "</table>";
                        // school_popuptext += "<br />Your location is missing? Add it <a href='https://github.com/opendata-stuttgart/luftdaten-local-labs' target='_blank' rel='noreferrer'>here</a>."
                        L.marker([data.default[i].lat, data.default[i].lon], {
                            icon: new labelRight(), riseOnHover: true, pane: 'markerPane2'
                        })
                            .bindPopup(school_popuptext)
                            .addTo(map);
                    }
    



    }
}
export default s2s