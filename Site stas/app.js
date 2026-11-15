const STOP_ID = "STAS:SP:27202641";
const FEED_URL = "https://bus-prod.saint-etienne-metropole.fr/Public/stas/api/horaires_tc/GTFS-RT.pb";
// Proxy CORS gratuit pour contourner la restriction navigateur
const PROXY = "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(FEED_URL);

async function maj() {
  const div = document.getElementById("horaires");
  try {
    const r = await fetch(PROXY);
    const buffer = await r.arrayBuffer();
    const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

    const passages = [];
    for (const entity of feed.entity) {
      const tu = entity.tripUpdate;
      if (!tu || !tu.trip || !tu.trip.routeId) continue;
      if (!tu.trip.routeId.toLowerCase().includes("t3")) continue;
      for (const stu of tu.stopTimeUpdate || []) {
        if (stu.stopId !== STOP_ID) continue;
        const t = Number(stu.departure?.time ?? stu.arrival?.time);
        if (!t) continue;
        const date = new Date(t * 1000);
        const min = Math.max(0, Math.round((date - Date.now()) / 60000));
        passages.push({ min, heure: date.toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"}) });
      }
    }
    passages.sort((a, b) => a.min - b.min);
    document.getElementById("maj").textContent = "Mis à jour à " + new Date().toLocaleTimeString("fr-FR");
    div.innerHTML = passages.length
      ? passages.slice(0, 4).map(p => `<div class="passage">${p.min} min <span class="heure">(${p.heure})</span></div>`).join("")
      : "Aucun tram à l'horizon 🌙";
  } catch (e) {
    div.textContent = "Erreur de chargement ❌";
    console.error(e);
  }
}
maj();
setInterval(maj, 30000);