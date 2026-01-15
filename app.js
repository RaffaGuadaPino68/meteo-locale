const API_KEY = "2da364bd21dc42a33821a351f3cce93f";

let map = null;
let currentLocation = null;

let cloudLayerA, cloudLayerB, cloudFadeTimer;
let savedMarkers = [];

/* =====================================================
   MAP INIT (UNA SOLA VOLTA)
===================================================== */
function initMap(lat = 44.5, lon = 9.0, zoom = 8) {
  if (map) return;

  map = L.map("map").setView([lat, lon], zoom);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Esri Satellite" }
  ).addTo(map);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap, © CARTO" }
  ).addTo(map);

  map.on("click", onMapClick);
}

/* =====================================================
   RICERCA LOCALITÀ
===================================================== */
async function searchCity() {
  const query = document.getElementById("cityInput").value;
  if (!query) return;

  const url =
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

  const res = await fetch(url, { headers: { "User-Agent": "MeteoLocaleApp" } });
  const places = await res.json();

  if (!places.length) {
    alert("Località non trovata");
    return;
  }

  const lat = parseFloat(places[0].lat);
  const lon = parseFloat(places[0].lon);
  const name = places[0].display_name.split(",")[0];

  currentLocation = { name, lat, lon };

  document.getElementById("saveBtn").style.display = "inline-block";

  loadWeather(lat, lon, false);
}

/* =====================================================
   SALVA LOCALITÀ CERCATA
===================================================== */
function saveCurrent() {
  if (!currentLocation) return;

  const saveBtn = document.getElementById("saveBtn");
  const saveMsg = document.getElementById("saveMsg");

  saveBtn.disabled = true;

  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

  if (favorites.some(f => f.lat === currentLocation.lat && f.lon === currentLocation.lon)) {
    alert("Località già salvata");
    saveBtn.disabled = false;
    return;
  }

  favorites.push(currentLocation);
  localStorage.setItem("favorites", JSON.stringify(favorites));

  loadFavorites();
  drawSavedMarkers();

  saveBtn.style.display = "none";
  saveMsg.style.display = "inline";

  setTimeout(() => {
    saveMsg.style.display = "none";
    saveBtn.disabled = false;
  }, 2000);
}

/* =====================================================
   METEO
===================================================== */
async function loadWeather(lat, lon, fromFavorite = false) {
  const weatherUrl =
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

  const res = await fetch(weatherUrl);
  const weather = await res.json();

  // 🔹 NOME LOCALITÀ (se disponibile)
  if (currentLocation && currentLocation.name) {
    document.getElementById("temp").innerHTML =
      `<div style="font-size:1.2rem; opacity:0.85;">${currentLocation.name}</div>
       <div style="font-size:3rem; font-weight:bold;">${weather.main.temp.toFixed(1)} °C</div>`;
  } else {
    document.getElementById("temp").innerText =
      `${weather.main.temp.toFixed(1)} °C`;
  }

  document.getElementById("details").innerText =
    `Min ${weather.main.temp_min}°  Max ${weather.main.temp_max}° • Percepita ${weather.main.feels_like}°`;

  loadMap(lat, lon, fromFavorite);
}


/* =====================================================
   MAPPA + NUVOLE
===================================================== */
function loadMap(lat, lon, fromFavorite) {
  const zoom = fromFavorite ? 15 : 8;

  initMap(lat, lon, zoom);
  map.setView([lat, lon], zoom);

  if (cloudLayerA) map.removeLayer(cloudLayerA);
  if (cloudLayerB) map.removeLayer(cloudLayerB);
  if (cloudFadeTimer) clearInterval(cloudFadeTimer);

  cloudLayerA = L.tileLayer(
    `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
    { opacity: 0.9 }
  ).addTo(map);

  cloudLayerB = L.tileLayer(
    `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}&t=${Date.now()}`,
    { opacity: 0 }
  ).addTo(map);

  let showA = true;
  cloudFadeTimer = setInterval(() => {
    cloudLayerA.setOpacity(showA ? 0 : 0.9);
    cloudLayerB.setOpacity(showA ? 0.9 : 0);
    showA = !showA;
  }, 1500);

  drawSavedMarkers();
}

/* =====================================================
   CLICK MAPPA
===================================================== */
async function onMapClick(e) {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;

  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

  const res = await fetch(url);
  const weather = await res.json();

  const popupContent = `
    <strong>📍 Punto selezionato</strong><br>
    🌡️ ${weather.main.temp.toFixed(1)} °C<br><br>
    <input id="pointName" placeholder="Nome punto" style="width:100%;padding:4px"><br><br>
    <button onclick="saveClickedPoint(${lat}, ${lon})">⭐ Salva punto</button>
  `;

  L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
}

/* =====================================================
   SALVA PUNTO CLICCATO
===================================================== */
function saveClickedPoint(lat, lon) {
  const nameInput = document.getElementById("pointName");
  if (!nameInput || !nameInput.value.trim()) {
    alert("Inserisci un nome");
    return;
  }

  const name = nameInput.value.trim();
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

  if (favorites.some(f => f.lat === lat && f.lon === lon)) {
    alert("Punto già salvato");
    return;
  }

  favorites.push({ name, lat, lon });
  localStorage.setItem("favorites", JSON.stringify(favorites));

  loadFavorites();
  drawSavedMarkers();
  map.closePopup();
}

/* =====================================================
   MARKER
===================================================== */
function drawSavedMarkers() {
  if (!map) return;

  savedMarkers.forEach(m => map.removeLayer(m));
  savedMarkers = [];

  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lon]).addTo(map);
    marker.bindPopup(`<strong>${loc.name}</strong>`);
    savedMarkers.push(marker);
  });
}

/* =====================================================
   APRI PREFERITO
===================================================== */
function openFavorite(loc) {
  currentLocation = loc;
  loadWeather(loc.lat, loc.lon, true);
}


/* =====================================================
   ELIMINA / RINOMINA (PER COORDINATE)
===================================================== */
function deleteFavoriteByCoords(lat, lon) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  favorites = favorites.filter(f => !(f.lat === lat && f.lon === lon));
  localStorage.setItem("favorites", JSON.stringify(favorites));
  loadFavorites();
  drawSavedMarkers();
}

function renameFavoriteByCoords(lat, lon) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  const fav = favorites.find(f => f.lat === lat && f.lon === lon);
  if (!fav) return;

  const nuovoNome = prompt("Rinomina località:", fav.name);
  if (!nuovoNome || !nuovoNome.trim()) return;

  fav.name = nuovoNome.trim();
  localStorage.setItem("favorites", JSON.stringify(favorites));
  loadFavorites();
  drawSavedMarkers();
}

/* =====================================================
   LISTA PREFERITI
===================================================== */
function loadFavorites() {
  const list = document.getElementById("favList");
  list.innerHTML = "";

  const favorites = JSON.parse(localStorage.getItem("favorites")) || [];

  favorites.forEach(loc => {
    const li = document.createElement("li");
    li.className = "fav-item";

    li.onclick = () => {
      // rimuove active da tutti
      document.querySelectorAll("#favList li").forEach(el =>
        el.classList.remove("active")
      );

      // attiva solo questo
      li.classList.add("active");

      openFavorite(loc);
    };

    const nameSpan = document.createElement("span");
    nameSpan.className = "fav-name";
    nameSpan.innerText = loc.name;
    nameSpan.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      renameFavoriteByCoords(loc.lat, loc.lon);
    };

    const delBtn = document.createElement("button");
    delBtn.className = "fav-delete";
    delBtn.innerHTML = "🗑️";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteFavoriteByCoords(loc.lat, loc.lon);
    };

    li.appendChild(nameSpan);
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}


/* =====================================================
   AVVIO
===================================================== */
loadFavorites();
