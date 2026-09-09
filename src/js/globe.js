// Real-time 3D globe visualization (three.js). Renders only when three.js
// loads and WebGL initializes successfully; fails silently otherwise
// (console.warn, never console.error/throw) so the text feed — the
// reliable source of truth for ISS data — is never affected by a
// rendering issue. Same principle for the extra satellites: if
// satellite.js or Celestrak's TLE data is unavailable, the globe still
// shows the real ISS marker; it just skips the ones it couldn't load.

(function (global) {
  "use strict";

  var EARTH_TEXTURE_URL =
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/earth_atmos_2048.jpg";

  // Real NORAD catalog numbers — orbital elements fetched once per session
  // (cached in localStorage for an hour) from Celestrak, then positions are
  // computed locally via SGP4 propagation (satellite.js), the same
  // technique real satellite trackers use. No repeated network polling.
  var EXTRA_SATELLITES = [
    { catnr: 20580, name: "Hubble", color: 0x66d9ff },
    { catnr: 48274, name: "Tiangong", color: 0xff8a3d },
    { catnr: 44714, name: "Starlink-1008", color: 0x8effa1 },
  ];
  var TLE_CACHE_KEY = "iss_globe_tle_cache_v1";
  var TLE_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // orbital elements barely change hour to hour
  var EXTRA_SAT_REFRESH_MS = 2000; // local math only — cheap, no network cost
  var TRAIL_LENGTH = 6; // fading "comet tail" dots per tracked object

  var scene, camera, renderer, controls, earthGroup, issMarker, earthMaterial;
  var ready = false;
  var rafHandle = null;
  var extraTickTimer = null;
  var generation = 0; // bumped on every init()/destroy() so stale async callbacks (a texture load or TLE fetch resolving after Disconnect) detect they're stale and no-op instead of touching disposed state
  var hasFramedInitialView = false;
  var extraSatellites = []; // {name, color, satrec, marker, trail}
  var issTrail = null;
  var legendCallback = null;

  // A trail exists so real orbital motion is visible as its own thing,
  // distinct from camera drags (which move the whole scene, marker and
  // trail together, and can't be mistaken for the satellite itself moving
  // once there's a visible tail stretching behind it that only grows when
  // a NEW real position arrives, never during a drag).
  function makeTrail(color) {
    var dots = [];
    for (var i = 0; i < TRAIL_LENGTH; i++) {
      var opacity = 0.45 * (1 - i / TRAIL_LENGTH);
      var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthTest: false });
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), mat);
      dot.visible = false;
      dot.renderOrder = 997;
      earthGroup.add(dot);
      dots.push(dot);
    }
    return { dots: dots, history: [] };
  }

  function pushTrail(trail, currentLocalPos) {
    if (!trail) return;
    trail.history.unshift(currentLocalPos.clone());
    if (trail.history.length > TRAIL_LENGTH) trail.history.length = TRAIL_LENGTH;
    trail.dots.forEach(function (dot, i) {
      var histPos = trail.history[i];
      if (histPos) {
        dot.position.copy(histPos);
        dot.visible = true;
      } else {
        dot.visible = false;
      }
    });
  }

  function latLonToVector3(lat, lon, radius) {
    var phi = (90 - lat) * (Math.PI / 180);
    var theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function buildStarfield() {
    var starCount = 400;
    var positions = new Float32Array(starCount * 3);
    for (var i = 0; i < starCount; i++) {
      var r = 6 + Math.random() * 8;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    var geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({ color: 0x8899bb, size: 0.035 });
    return new THREE.Points(geom, mat);
  }

  function makeMarkerGroup(color, coreSize, glowSize) {
    var group = new THREE.Group();
    var coreMat = new THREE.MeshBasicMaterial({ color: color, depthTest: false });
    var core = new THREE.Mesh(new THREE.SphereGeometry(coreSize, 12, 12), coreMat);
    var glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4, depthTest: false });
    var glow = new THREE.Mesh(new THREE.SphereGeometry(glowSize, 16, 16), glowMat);
    glow.name = "glow";
    group.add(glow);
    group.add(core);
    group.renderOrder = 998;
    group.visible = false;
    return group;
  }

  function init(containerEl, onLegendUpdate) {
    if (typeof THREE === "undefined") {
      console.warn("Globe: three.js not loaded, skipping 3D visualization.");
      return false;
    }
    try {
      generation += 1;
      var thisGeneration = generation;
      legendCallback = onLegendUpdate || null;
      hasFramedInitialView = false;
      extraSatellites = [];

      var width = containerEl.clientWidth || 320;
      var height = 320;

      scene = new THREE.Scene();
      // ISS orbital inclination is ~51.6 deg, so a marker can sit as far as
      // +/-51.6 deg latitude — camera framing must keep that entire band in
      // view, not just the equator. No Y offset (symmetric framing) and
      // enough distance to cover it with margin.
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.4);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      containerEl.innerHTML = "";
      containerEl.appendChild(renderer.domElement);

      if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.6;
        controls.enablePan = false;
        controls.minDistance = 2.2;
        controls.maxDistance = 8;
      } else {
        controls = null;
        console.warn("Globe: OrbitControls not loaded — globe will be view-only.");
      }

      scene.add(new THREE.AmbientLight(0x556080, 1.1));
      var sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(4, 2, 3);
      scene.add(sun);
      scene.add(buildStarfield());

      earthGroup = new THREE.Group();
      scene.add(earthGroup);

      earthMaterial = new THREE.MeshPhongMaterial({ color: 0x335577, shininess: 6 });
      earthGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), earthMaterial));

      var loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        EARTH_TEXTURE_URL,
        function (texture) {
          if (thisGeneration !== generation || !earthMaterial) return; // disposed before this resolved
          earthMaterial.map = texture;
          earthMaterial.color.set(0xffffff);
          earthMaterial.needsUpdate = true;
        },
        undefined,
        function () {
          if (thisGeneration !== generation) return;
          console.warn("Globe: earth texture failed to load — using a flat-shaded sphere instead.");
        }
      );

      // A visible core dot plus a larger transparent glow sphere behind it,
      // pulsing — at this render scale a bare static dot reads as a stray
      // highlight on the texture rather than an obvious marker.
      issMarker = makeMarkerGroup(0xfff23c, 0.045, 0.13);
      issMarker.renderOrder = 999;
      earthGroup.add(issMarker);
      issTrail = makeTrail(0xfff23c);

      ready = true;
      rafHandle = requestAnimationFrame(animate);
      loadExtraSatellites(thisGeneration);
      return true;
    } catch (err) {
      console.warn("Globe: initialization failed, skipping 3D visualization.", err);
      return false;
    }
  }

  function pulseMarker(t, markerGroup) {
    if (!markerGroup || !markerGroup.visible) return;
    var pulse = 1 + 0.35 * Math.sin(t / 350);
    var glowMesh = markerGroup.getObjectByName("glow");
    if (glowMesh) glowMesh.scale.setScalar(pulse);
  }

  function animate(t) {
    if (!ready) return;
    if (controls) controls.update();
    pulseMarker(t, issMarker);
    extraSatellites.forEach(function (sat) {
      pulseMarker(t, sat.marker);
    });
    renderer.render(scene, camera);
    rafHandle = requestAnimationFrame(animate);
  }

  function setIssPosition(lat, lon) {
    if (!ready || !issMarker) return;
    if (issMarker.visible) pushTrail(issTrail, issMarker.position);
    var localPos = latLonToVector3(lat, lon, 1.03);
    issMarker.position.copy(localPos);
    issMarker.visible = true;
    // Frame the initial view toward the ISS once, then leave rotation
    // entirely to OrbitControls — with multiple satellites there's no
    // single "correct" point to keep auto-facing.
    if (!hasFramedInitialView) {
      hasFramedInitialView = true;
      earthGroup.rotation.y = Math.atan2(-localPos.x, localPos.z);
    }
  }

  function tleUrl(catnr) {
    return "https://celestrak.org/NORAD/elements/gp.php?CATNR=" + catnr + "&FORMAT=tle";
  }

  function loadTleCache() {
    try {
      var raw = global.localStorage.getItem(TLE_CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() - data.fetchedAt > TLE_CACHE_MAX_AGE_MS) return null;
      return data.entries;
    } catch (e) {
      return null;
    }
  }

  function saveTleCache(entries) {
    try {
      global.localStorage.setItem(TLE_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), entries: entries }));
    } catch (e) {
      // localStorage unavailable (private browsing etc.) — just skip caching
    }
  }

  async function fetchTle(catnr) {
    var res = await fetch(tleUrl(catnr));
    if (!res.ok) throw new Error("HTTP " + res.status);
    var text = (await res.text()).trim();
    var lines = text.split("\n").map(function (l) { return l.trim(); });
    if (lines.length < 3) throw new Error("unexpected TLE format");
    return { line1: lines[1], line2: lines[2] };
  }

  async function loadExtraSatellites(thisGeneration) {
    if (typeof satellite === "undefined") {
      console.warn("Globe: satellite.js not loaded, skipping the extra satellites (ISS still tracks live).");
      return;
    }

    var entries = loadTleCache();
    if (!entries) {
      entries = {};
      var results = await Promise.allSettled(EXTRA_SATELLITES.map(function (s) { return fetchTle(s.catnr); }));
      results.forEach(function (r, i) {
        if (r.status === "fulfilled") entries[EXTRA_SATELLITES[i].catnr] = r.value;
        else console.warn("Globe: TLE fetch failed for " + EXTRA_SATELLITES[i].name + " — skipping it.", r.reason);
      });
      if (Object.keys(entries).length > 0) saveTleCache(entries);
    }

    if (thisGeneration !== generation) return; // Disconnect happened while we were fetching

    EXTRA_SATELLITES.forEach(function (s) {
      var tle = entries[s.catnr];
      if (!tle) return;
      try {
        var satrec = satellite.twoline2satrec(tle.line1, tle.line2);
        var marker = makeMarkerGroup(s.color, 0.035, 0.1);
        earthGroup.add(marker);
        var trail = makeTrail(s.color);
        extraSatellites.push({ name: s.name, color: s.color, satrec: satrec, marker: marker, trail: trail });
      } catch (err) {
        console.warn("Globe: failed to parse TLE for " + s.name, err);
      }
    });

    updateExtraSatellitePositions();
    extraTickTimer = setInterval(updateExtraSatellitePositions, EXTRA_SAT_REFRESH_MS);
  }

  function updateExtraSatellitePositions() {
    if (!ready) return;
    var now = new Date();
    var gmst = satellite.gstime(now);
    var legendData = [];
    extraSatellites.forEach(function (sat) {
      try {
        var pv = satellite.propagate(sat.satrec, now);
        if (!pv || !pv.position) return;
        var geo = satellite.eciToGeodetic(pv.position, gmst);
        var lat = satellite.degreesLat(geo.latitude);
        var lon = satellite.degreesLong(geo.longitude);
        if (sat.marker.visible) pushTrail(sat.trail, sat.marker.position);
        sat.marker.position.copy(latLonToVector3(lat, lon, 1.03));
        sat.marker.visible = true;
        legendData.push({ name: sat.name, color: sat.color, lat: lat, lon: lon });
      } catch (err) {
        // Leave the marker at its last known position on a transient
        // propagation error rather than hiding it.
      }
    });
    if (legendCallback) legendCallback(legendData);
  }

  function destroy() {
    generation += 1; // invalidate any in-flight texture-load / TLE-fetch callbacks immediately
    ready = false;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    if (extraTickTimer) clearInterval(extraTickTimer);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    scene = camera = renderer = controls = earthGroup = issMarker = earthMaterial = null;
    extraSatellites = [];
    issTrail = null;
    legendCallback = null;
  }

  global.IssGlobe = { init: init, setIssPosition: setIssPosition, destroy: destroy };
})(window);
