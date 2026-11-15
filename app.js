const GTFS_RT_URL = "https://bus-prod.saint-etienne-metropole.fr/Public/stas/api/horraires_tc/GTFS-RT.pb";
const PROXY = "https://api.codetabs.com/v1/proxy?quest=";

const protoDefinition = `
syntax = "proto2";
package transit_realtime;
message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}
message FeedHeader { required int64 timestamp = 2; }
message FeedEntity {
  required string id = 1;
  optional TripUpdate trip_update = 3;
}
message TripUpdate {
  optional string trip_id = 1;
  optional string route_id = 5;
  repeated StopTimeUpdate stop_time_update = 2;
}
message StopTimeUpdate {
  optional string stop_id = 4;
  optional uint32 stop_sequence = 2;
  optional StopTimeEvent arrival = 1;
  optional StopTimeEvent departure = 3;
}
message StopTimeEvent { optional int64 time = 1; optional int32 delay = 2; }
`;

const container = document.getElementById("departures");

async function debug() {
  container.innerHTML = "Chargement...";
  try {
    const response = await fetch(PROXY + encodeURIComponent(GTFS_RT_URL));
    const buffer = await response.arrayBuffer();
    const root = protobuf.parse(protoDefinition).root;
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
    const message = FeedMessage.decode(new Uint8Array(buffer));

    // Compte les stop_id présents dans le flux
    const stopCounts = {};
    let nbTrips = 0;
    const routeIds = new Set();

    for (const entity of message.entity) {
      const tu = entity.trip_update;
      if (!tu) continue;
      nbTrips++;
      if (tu.route_id) routeIds.add(tu.route_id);
      for (const stu of tu.stop_time_update || []) {
        if (stu.stop_id) {
          stopCounts[stu.stop_id] = (stopCounts[stu.stop_id] || 0) + 1;
        }
      }
    }

    // Affiche les routes trouvées
    let html = `<div class="message"><b>${nbTrips} voyages actifs</b><br>
      Routes trouvées : ${[...routeIds].join(", ") || "aucune"}<br><br>
      <b>Stop IDs contenant "27G" ou "26G" (Bellevue) :</b><br>`;
    for (const [sid, count] of Object.entries(stopCounts)) {
      if (sid.includes("27G") || sid.includes("26G")) {
        html += `${sid} → ${count} passage(s)<br>`;
      }
    }
    html += `</div>`;
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = "❌ Erreur : " + error.message;
  }
}

debug();
