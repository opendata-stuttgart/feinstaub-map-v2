import 'whatwg-fetch';
import checkStatus from './utils';

let dataRetrieved = false;

const labs = {
  getData: async function (URL, map) {
    const labelBaseOptions = {
      iconUrl: 'images/labMarker.svg',
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
        const data = await checkStatus(response).json();
        for (const { lat, lon, title, meetings, meetings_title, contacts, contacts_title, website, facebook, facebook_group, facebook_page, twitter, github, gitlab, mastodon, meetup, telegram, telegram_group } of data) {
          let lab_popuptext = `<b>${title}</b><br/><br/>`;
          if (meetings) {
            lab_popuptext += `<b>${meetings_title || "Meetings"}<br /></b>`;
            meetings.forEach(meeting => {
              lab_popuptext += `${meeting.text}<br />`;
            });
            lab_popuptext += "<br />";
          }
          if (contacts) {
            lab_popuptext += `<b>${contacts_title || "Contacts"}<br /></b>`;
            contacts.forEach(contact => {
              lab_popuptext += `<a href="${contact.url}">${contact.name}</a><br />`;
            });
            lab_popuptext += "<br />";
          }
          if (website) {
            lab_popuptext += `<b>Website</b><br/><a href="${website}" target="_blank" rel="noreferrer">${website}</a><br /><br />`;
          }
          lab_popuptext += "<table class='labs_sociallinks' style='width: auto;margin-left:0;'>";
          if (facebook) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/${facebook}' target='_blank' rel='noreferrer'>${facebook}</a></td></tr>`;
          }
          if (facebook_group) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/groups/${facebook_group}' target='_blank' rel='noreferrer'>${facebook_group}</a></td></tr>`;
          }
          if (facebook_page) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_facebook'></td><td><a href='https://www.facebook.com/${facebook_page}' target='_blank' rel='noreferrer'>${facebook_page}</a></td></tr>`;
          }
          if (twitter) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_twitter'></td><td><a href='https://twitter.com/${twitter}' target='_blank' rel='noreferrer'>@${twitter}</a></td></tr>`;
          }
          if (github) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_github'></td><td><a href='https://github.com/${github}' target='_blank' rel='noreferrer'>${github}</a></td></tr>`;
          }
          if (gitlab) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_gitlab'></td><td><a href='https://gitlab.com/${gitlab}' target='_blank' rel='noreferrer'>${gitlab}</a></td></tr>`;
          }
          if (mastodon) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_mastodon'></td><td><a href='${mastodon}' target='_blank' rel='noreferrer'>${mastodon}</a></td></tr>`;
          }
          if (meetup) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_meetup'></td><td><a href='https://www.meetup.com/${meetup}' target='_blank' rel='noreferrer'>${meetup}</a></td><tr>`;
          }
          if (telegram) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_telegram'></td><td><a href='https://t.me/${telegram}' target='_blank' rel='noreferrer'>@${telegram}</a></td></tr>`;
          }
          if (telegram_group) {
            lab_popuptext += `<tr><td class='labsSocialIcon labs_telegram'></td><td><a href='https://t.me/${telegram_group}' target='_blank' rel='noreferrer'>${telegram_group}</a></td></tr>`;
          }
          lab_popuptext += "</table>";
          lab_popuptext += "<br />Your location is missing? Add it <a href='https://github.com/opendata-stuttgart/luftdaten-local-labs' target='_blank' rel=' noreferrer'>here</a>."
          L.marker([lat, lon], {
              icon: new labelRight(), riseOnHover: true, pane: 'markerPane1'
          })
              .bindPopup(lab_popuptext)
              .addTo(map);
        }
        dataRetrieved = true;
      } catch (error) {
        console.log('request failed', error);
      }
    }
  }
};

export default labs;