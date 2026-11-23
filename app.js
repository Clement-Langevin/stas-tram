const PROXY = "https://stas-proxy.clement-langevin73.workers.dev/";
const STOP_ID = ""; // à remplir après avoir vu la liste en console
const container = document.getElementById("departures");
const status = document.getElementById("status");

const PROTO = `
syntax = "proto2";
message FeedMessage { repeated FeedEntity entity = 2; }
message FeedEntity { optional string id = 1; optional TripUpdate trip_update = 3; }
message TripUpdate {
  optional TripDescriptor trip = 1;
  repeated StopTimeUpdate stop_time_update = 2;
}
message TripDescriptor { optional string trip_id = 1; optional string route_id = 5; }
message StopTimeUpdate {
  optional string stop_id = 4;
  optional StopTimeEvent arrival = 2;
  optional StopTimeEvent departure = 3;
}
message StopTimeEvent { optional int32 delay = 1; optional int64 time = 2; }
`;

function afficherMessage(msg) {
  container.innerHTML = `<div class="departure">${msg}</div>`;
}

function heure(ts) {
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function minutes(ts) {
  const diff = Math.round((ts * 1000 - Date.now()) / 60000);
  if (diff <= 0) return "à l'approche";
  return "dans " + diff + " min";
}

async function chargerTempsReel() {
  status.textContent = "Chargement...";
  try {
    const res = await fetch(PROXY);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const buffer = await res.arrayBuffer();

    const root = protobuf.parse(PROTO).root;
    const FeedMessage = root.lookupType("FeedMessage");
    const feed = FeedMessage.decode(new Uint8Array(buffer));

    // Mode découverte : liste les arrêts si STOP_ID est vide
    if (!STOP_ID) {
      const arrets = new Set();
      feed.entity.forEach(e => {
        if (!e.tripUpdate) return;
        const route = e.tripUpdate.trip?.routeId;
        e.tripUpdate.stopTimeUpdate.forEach(s => arrets.add(s.stopId + " (ligne " + route + ")"));
      });
      console.log("Arrêts du flux :", [...arrets]);
      afficherMessage("STOP_ID vide : regarde la console (F12) pour la liste des arrêts.");
      status.textContent = "";
      return;
    }

    const departs = [];
    feed.entity.forEach(e => {
      if (!e.tripUpdate) return;
      e.tripUpdate.stopTimeUpdate.forEach(s => {
        if (s.stopId !== STOP_ID) return;
        const t = s.departure?.time || s.arrival?.time;
        if (!t) return;
        departs.push({ route: e.tripUpdate.trip?.routeId, heure: Number(t) });
      });
    });

    departs.sort((a, b) => a.heure - b.heure);

    if (departs.length === 0) {
      afficherMessage("Aucun passage trouvé.");
    } else {
      container.innerHTML = departs.slice(0, 5).map(d => `
        <div class="departure">Ligne ${d.route} : ${heure(d.heure)} (${minutes(d.heure)})</div>
      `).join("");
    }
    status.textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR");
  } catch (error) {
    status.textContent = "";
    afficherMessage("Erreur : " + error.message);
  }
}

chargerTempsReel();
setInterval(chargerTempsReel, 30000);
