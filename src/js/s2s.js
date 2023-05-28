import 'whatwg-fetch';

let dataRetrieved = false;

const s2s = {
  getData: async function (URL, map) {
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

    if (!dataRetrieved) {
      try {
        const response = await fetch(URL);
        const data = await response.json();
        for (const { lat, lon, title, contacts, contacts_title, partner, partner_title, website, facebook_page } of data) {
          let school_popuptext = `<h3>${title}</h3><br/>`;
          if (contacts) {
            school_popuptext += "<b>";
            school_popuptext += contacts_title || "Contacts";
            school_popuptext += "<br /></b>";
            contacts.forEach(contact => {
              school_popuptext += `<a href="${contact.url}">${contact.name}</a><br />`;
            });
            school_popuptext += "<br />";
          }
          if (partner) {
            school_popuptext += "<b>";
            school_popuptext += partner_title || "Partner";
            school_popuptext += "<br /></b>";
            partner.forEach(partner => {
              school_popuptext += `<a href="${partner.url}">${partner.name}</a><br />`;
            });
            school_popuptext += "<br />";
          }
          if (website) {
            school_popuptext += `<b>Website</b><br/><a href="${website}" target="_blank" rel="noreferrer">${website}</a><br />`;
          }
          if (facebook_page) {
            school_popuptext += `<b>Facebook</b><br/><tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/${facebook_page}' target='_blank' rel='noreferrer'>${facebook_page}</a></td></tr>`;
          }
          L.marker([lat, lon], {
              icon: new labelRight(), riseOnHover: true, pane: 'markerPane2'
          })
              .bindPopup(school_popuptext)
              .addTo(map);
        }
        dataRetrieved = true;
      } catch (error) {
        console.log('request failed', error);
      }
    }
  }
};

export default s2s;