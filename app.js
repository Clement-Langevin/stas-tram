// ===== CONFIG =====
const GTFS_RT_URL = "https://bus-prod.saint-etienne-metropole.fr/Public/stas/api/horraires_tc/GTFS-RT.pb";
const PROXY = "https://api.codetabs.com/v1/proxy?quest=";

// ⚠️ À REMPLIR : l'ID GTFS de l'arrêt Bellevue (voir note plus bas)
const STOP_ID = "BELLEVUE"; // ← on corrigera après vérification
const ROUTE_ID = "";        // filtre ligne (ex: "3" pour T3) — peut rester vide au début
const HEADSIGN = "Châteaucreux"; // filtre direction

// ===== Définition protobuf GTFS-RT (extrait trip_updates) =====
const protoDefinition = `
syntax = "proto2";
package transit_realtime;
message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}
message FeedHeader {
  required int64 timestamp = 2;
}
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
message StopTimeEvent {
  optional int64 time = 1;
  optional int32 delay = 2;
}
`;

// ===== Affichage =====
const container = document.getElementById("departures");
const status = document.getElementById("status");

function afficherMessage(msg) {
  container.innerHTML = `<div class="message">${msg}</div>`;
}

function formaterHeure(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutesRestantes(timestamp) {
  const diff = Math.round((timestamp * 1000 - Date.now()) / 60000);
  if (diff <= 0) return "à l'approche";
  return "dans " + diff + " min";
}

// ===== Récupération + décodage =====
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

    for (const entity of message.entity) {
      const tu = entity.trip_update;
      if (!tu) continue;

      for (const stu of tu.stop_time_update || []) {
        if (stu.stop_id !== STOP_ID) continue;

        const event = stu.departure || stu.arrival;
        if (!event || !event.time) continue;
        if (event.time < maintenant - 60) continue; // déjà passé

        let direction = "—";
        if (HEADSIGN && tu.trip && tu.trip.headsign) direction = tu.trip.trip.headsign;
        departs.push({
          heure: event.time,
          retard: event.delay || 0,
          route: tu.route_id || "?",
          direction: direction
        });
      }
    }

    departs.sort((a, b) => a.heure - b.heure);

    if (departs.length === 0) {
      afficherMessage("Aucun passage trouvé. Vérifie STOP_ID ou attends le prochain tram 🚋");
    } else {
      container.innerHTML = departs.slice(0, 5).map(d => `
        <div class="departure">
          <span class="ligne">${d.route}</span>
          <span class="direction">${d.direction}</span>
          <span class="heure">${formaterHeure(d.heure)}</span>
          <span class="attente">${minutesRestantes(d.heure)}</span>
          ${d.retard > 60 ? `<span class="retard">+${Math.round(d.retard / 60)} min de retard</span>` : ""}
        </div>
      `).join("");
    }
    status.textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR");
  } catch (error) {
    status.textContent = "";
    afficherMessage("❌ Erreur : " + error.message);
  }
}

chargerTempsReel();
setInterval(chargerTempsReel, 30000); // refresh toutes les 30s
