// ===== CONFIG =====
const GTFS_RT_URL = "https://bus-prod.saint-etienne-metropole.fr/Public/stas/api/horraires_tc/GTFS-RT.pb";
const PROXY = "https://corsproxy.io/?url=";   // renvoie les octets bruts

// À remplir après avoir fait le mode DEBUG ci-dessous
const STOP_ID = "";      // ex: "BELLEVUE_1" (le vrai ID GTFS)
const ROUTE_ID = "";     // ex: "T3" (vide = pas de filtre)
const DEBUG = true;      // affiche les stop_id trouvés dans la console

const protoDefinition = `
syntax = "proto2";
package transit_realtime;
message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}
message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional uint64 timestamp = 3;
}
message FeedEntity {
  required string id = 1;
  optional TripUpdate trip_update = 3;
}
message TripDescriptor {
  optional string trip_id = 1;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
}
message TripUpdate {
  required TripDescriptor trip = 1;
  repeated StopTimeUpdate stop_time_update = 2;
}
message StopTimeUpdate {
  optional uint32 stop_sequence = 1;
  optional StopTimeEvent arrival = 2;
  optional StopTimeEvent departure = 3;
  optional string stop_id = 4;
}
message StopTimeEvent {
  optional int32 delay = 1;
  optional int64 time = 2;
}
`;

const container = document.getElementById("horaires");
const status = document.getElementById("maj");

function afficherMessage(msg) {
  container.innerHTML = `<div class="passage">${msg}</div>`;
}

function formaterHeure(ts) {
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutesRestantes(ts) {
  const diff = Math.round((ts * 1000 - Date.now()) / 60000);
  return diff <= 0 ? "À l'approche" : "dans " + diff + " min";
}

async function chargerTempsReel() {
  status.textContent = "Chargement...";
  try {
    const response = await fetch(PROXY + encodeURIComponent(GTFS_RT_URL));
    if (!response.ok) throw new Error("HTTP " + response.status);
    const buffer = await response.arrayBuffer();

    const root = protobuf.parse(protoDefinition).root;
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
    const message = FeedMessage.decode(new Uint8Array(buffer));

    const maintenant = Math.floor(Date.now() / 1000);
    const departs = [];
    const stopsVus = new Set();

    for (const entity of message.entity) {
      const tu = entity.tripUpdate;           // protobufjs convertit en camelCase
      if (!tu) continue;
      const routeId = tu.trip && tu.trip.routeId;

      for (const stu of tu.stopTimeUpdate || []) {
        if (DEBUG) stopsVus.add(`${stu.stopId} (ligne ${routeId})`);
        if (!STOP_ID || stu.stopId !== STOP_ID) continue;
        if (ROUTE_ID && routeId !== ROUTE_ID) continue;

        const event = stu.departure || stu.arrival;
        if (!event || !event.time) continue;
        const t = Number(event.time);         // peut être un Long
        if (t < maintenant - 60) continue;

        departs.push({ heure: t, retard: event.delay || 0, route: routeId || "?" });
      }
    }

    if (DEBUG) console.log("Arrêts présents dans le flux :", [...stopsVus].sort());

    departs.sort((a, b) => a.heure - b.heure);

    if (!STOP_ID) {
      afficherMessage("⚠️ STOP_ID non défini : ouvre la console (F12) pour voir la liste des arrêts");
    } else if (departs.length === 0) {
      afficherMessage("Aucun passage trouvé 🚋");
    } else {
      container.innerHTML = departs.slice(0, 4).map(d => `
        <div class="passage">${minutesRestantes(d.heure)}</div>
        <div class="heure">${formaterHeure(d.heure)}${d.retard > 60 ? " (+" + Math.round(d.retard / 60) + " min)" : ""}</div>
      `).join("");
    }
    status.textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR");
  } catch (error) {
    status.textContent = "";
    afficherMessage("❌ " + error.message);
    console.error(error);
  }
}

chargerTempsReel();
setInterval(chargerTempsReel, 30000);
