// Real-time 3D ISS globe visualization (three.js). Renders only when
// three.js loads and WebGL initializes successfully; fails silently
// otherwise (console.warn, never console.error/throw) so the text feed —
// the reliable source of truth — is never affected by a rendering issue.

(function (global) {
  "use strict";

  var EARTH_TEXTURE_URL =
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/textures/planets/earth_atmos_2048.jpg";
  var TRACKING_DAMPING_PER_SEC = 0.7; // how eagerly the globe reorients to face the ISS

  var scene, camera, renderer, earthGroup, issMarker, earthMaterial;
  var ready = false;
  var lastFrameTime = null;
  var rafHandle = null;
  var targetRotationY = 0;

  function latLonToVector3(lat, lon, radius) {
    var phi = (90 - lat) * (Math.PI / 180);
    var theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  // Shortest-path angle interpolation (avoids spinning the long way around).
  function lerpAngle(a, b, t) {
    var diff = (((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return a + diff * t;
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

  function init(containerEl) {
    if (typeof THREE === "undefined") {
      console.warn("Globe: three.js not loaded, skipping 3D visualization.");
      return false;
    }
    try {
      var width = containerEl.clientWidth || 320;
      var height = 320;

      scene = new THREE.Scene();
      // ISS orbital inclination is ~51.6 deg, so the marker can sit as far
      // as +/-51.6 deg latitude — camera framing must keep that entire band
      // in view, not just the equator. No Y offset (symmetric framing) and
      // enough distance to cover it with margin.
      camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.4);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      containerEl.innerHTML = "";
      containerEl.appendChild(renderer.domElement);

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
          earthMaterial.map = texture;
          earthMaterial.color.set(0xffffff);
          earthMaterial.needsUpdate = true;
        },
        undefined,
        function () {
          console.warn("Globe: earth texture failed to load — using a flat-shaded sphere instead.");
        }
      );

      // A visible core dot plus a larger transparent glow sphere behind it,
      // pulsing — at this render scale a bare static dot reads as a stray
      // highlight on the texture rather than an obvious marker.
      issMarker = new THREE.Group();
      var coreMat = new THREE.MeshBasicMaterial({ color: 0xfff23c, depthTest: false });
      var core = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), coreMat);
      var glowMat = new THREE.MeshBasicMaterial({ color: 0xfff23c, transparent: true, opacity: 0.4, depthTest: false });
      var glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), glowMat);
      glow.name = "glow";
      issMarker.add(glow);
      issMarker.add(core);
      issMarker.renderOrder = 999;
      issMarker.visible = false;
      earthGroup.add(issMarker);

      ready = true;
      lastFrameTime = null;
      targetRotationY = 0;
      rafHandle = requestAnimationFrame(animate);
      return true;
    } catch (err) {
      console.warn("Globe: initialization failed, skipping 3D visualization.", err);
      return false;
    }
  }

  function animate(t) {
    if (!ready) return;
    if (lastFrameTime !== null) {
      var dt = (t - lastFrameTime) / 1000;
      earthGroup.rotation.y = lerpAngle(earthGroup.rotation.y, targetRotationY, Math.min(1, TRACKING_DAMPING_PER_SEC * dt));
    }
    lastFrameTime = t;
    if (issMarker && issMarker.visible) {
      var pulse = 1 + 0.35 * Math.sin(t / 350);
      var glowMesh = issMarker.getObjectByName("glow");
      if (glowMesh) glowMesh.scale.setScalar(pulse);
    }
    renderer.render(scene, camera);
    rafHandle = requestAnimationFrame(animate);
  }

  function setIssPosition(lat, lon) {
    if (!ready || !issMarker) return;
    var localPos = latLonToVector3(lat, lon, 1.03);
    issMarker.position.copy(localPos);
    issMarker.visible = true;
    // Rotate the globe so this point faces the camera (+Z), keeping the
    // marker in view instead of leaving it to chance on the far side.
    targetRotationY = Math.atan2(-localPos.x, localPos.z);
  }

  function destroy() {
    ready = false;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    if (renderer) renderer.dispose();
    scene = camera = renderer = earthGroup = issMarker = earthMaterial = null;
  }

  global.IssGlobe = { init: init, setIssPosition: setIssPosition, destroy: destroy };
})(window);
