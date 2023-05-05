import short from "shortid";
import * as THREE from "three";
import { MathUtils } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { MMDLoader } from "three/examples/jsm/loaders/MMDLoader.js";
import { throttle } from "throttle-debounce";
import "./style.css";
import * as lobby from "./lobby";

MathUtils.seededRandom(Date.now);

const traceRateInMillis = 50;

const logTrace = throttle(1000, false, console.log);

let otherPlayers = {};
let otherPlayersMeshes = {};

let items = {};
let itemMeshes = {};

let sendYourPosition;

// Default
let boundaries = { width: 89, height: 23 };

if (!localStorage.getItem("yourId")) {
  localStorage.setItem("yourId", short());
}
const yourId = localStorage.getItem("yourId");
let playerName = localStorage.getItem("yourName") || "Default";

let renderer;
let scene;
let canvas;
let player;
let turtleModel;
let gameOverFlag = false;
let camera;
let textureEquirec, sphereMaterial;

let scoreFromBackend;
let localScore = 0;
let timerId;
let gameDuration;
let worker;
let remainingTime;

let keyboard = {};

lobby.getLeaderBoard();

const createGameButton = document.getElementById("create-game-button");
createGameButton.addEventListener("click", init);

async function init() {
  scene = new THREE.Scene();
  
  // const listener = new THREE.AudioListener();


  const textureLoader = new THREE.TextureLoader();
  const textureEquirec = await new Promise((resolve) => {
    textureLoader.load("assets/envmap.png", (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.encoding = THREE.sRGBEncoding;
      console.log("Texture loaded:", texture);
      resolve(texture);
    });
  });

  // Set up the scene

  scene.background = textureEquirec;
  scene.environment = textureEquirec;

  // Load the GLTF models
  const loader = new GLTFLoader();
  const boatGltf = await loader.loadAsync("assets/boat3.gltf");
  const boatModel = boatGltf.scene.children[0];
  const turtleGltf = await loader.loadAsync("assets/turtle.gltf");
  const turtleModel = turtleGltf.scene.children[0];
 
    const geometries = [
    new THREE.SphereGeometry(),
    new THREE.BoxGeometry(),
    new THREE.BufferGeometry(),
  ];

  const materials = [
    new THREE.MeshPhongMaterial({ color: 0x00ff00 }), // Green material for wildlife
    new THREE.MeshPhongMaterial({ color: 0xff0000 }), // Red material for trash
  ];

  // Comms
  const hostname = window.location.hostname;
  const isDevelopment = hostname === "localhost";
  const wsURL = isDevelopment ? "ws://localhost:3000" : "ws://";

  worker = new Worker(new URL("./commsWorker.js", import.meta.url));
  worker.postMessage({
    type: "init",
    body: { wsURL, yourId, yourName: playerName },
  });

  worker.onmessage = ({ data }) => {
    const { type, body, error } = data;
    if (error) {
      console.error(error);
      Object.keys(otherPlayersMeshes).forEach((id) =>
        scene.remove(otherPlayersMeshes[id])
      );
      otherPlayers = {};
      otherPlayersMeshes = {};
    }
    switch (type) {
      case "connect":
        console.log("Web Socket connection");
        break;
      case "disconnect":
        console.log("Web Socket disconnection");
        break;
      case "log":
        console.log(body);
        break;
      case "server.info":
        console.log(`Connected to server ${body.id}`);
        console.log(`Game duration ${body.gameDuration} seconds`);
        gameDuration = body.gameDuration;
        // console.log(`World X: ${body.worldSizeX} World Z: ${body.worldSizeZ}`);
        boundaries.width = body.worldSizeX;
        boundaries.height = body.worldSizeZ;
        console.log(`Updated boundaries: width: ${boundaries.width}, height: ${boundaries.height}`);
        break;
      case "game.on":
        worker.postMessage({
          type: "game.start",
          body: { playerId: yourId, playerName },
        });
        startGame(gameDuration, [boatModel, turtleModel]);
        break;
      case "game.end":
        endGame();
        break;
      case "items.all":
        Object.keys(body).forEach((key) => {
          if (!items[key]) {
            createItemMesh(
              key,
              body[key].type,
              body[key].position,
              body[key].size
            );
          }
          items[key] = body[key];
        });
        break;
      case "item.new":
        const { id: itemIdToCreate, data: itemData } = body;
        createItemMesh(
          itemIdToCreate,
          itemData.type,
          itemData.position,
          itemData.size
        );
        items[itemIdToCreate] = itemData;
        break;
      case "item.destroy":
        const itemIdToDestroy = body;
        const item = items[itemIdToDestroy];
        const mesh = itemMeshes[itemIdToDestroy];
        if (item && mesh) {
          scene.remove(mesh);
          delete items[itemIdToDestroy];
          delete itemMeshes[itemIdToDestroy];
        }
        break;
      case "player.trace.all":
        for (const [key, traceData] of Object.entries(body)) {
          otherPlayers[key] = traceData;
          if (!otherPlayersMeshes[key]) {
            otherPlayersMeshes[key] = makePlayerMesh(boatModel, scene);
          }
        }
        break;
      case "player.info.joined":
        const { id: joinedId, name: joinedName } = body;
        if (joinedId !== yourId) {
          otherPlayersMeshes[joinedId] = makePlayerMesh(boatModel, scene);
        }
        break;
      case "player.info.left":
        const playerId = body;
        if (playerId !== yourId) {
          scene.remove(otherPlayersMeshes[playerId]);
          delete otherPlayersMeshes[playerId];
          delete otherPlayers[playerId];
        }
        break;
      case "player.info.all":
        // FIXME update player info
        console.log("player.info.all", body);
        // otherPlayers
        break;
      default:
        break;
    }
  };

  // FIXME Disconnect properly when kill tab, reload, etc
  window.addEventListener("beforeunload", function (e) {
    console.log("beforeunload");
  });

  function makePlayerMesh(playerMesh, scene) {
    const group = new THREE.Group();

    // Clone the player's mesh
    const mesh = playerMesh.clone();
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);

    // Set the material of the new mesh to white
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
    });
    mesh.material = playerMaterial;

    // Traverse the new mesh and set the shadow properties
    mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    // Add the mesh and label to the group
    group.add(mesh);
    // group.add(nameLabel);

    // Add the group to the scene
    scene.add(group);

    return group;
  }

  // Create a random trash or wildlife object
  function createItemMesh(itemId, itemType, position, size) {
    // FIXME use marine life models when isMarineLife() returns true
    const geometry = isMarineLife(itemType) ? geometries[0] : geometries[1];
    const material = isMarineLife(itemType) ? materials[0] : materials[1];
    const itemMesh = new THREE.Mesh(geometry, material);
    itemMesh.position.set(position.x, position.y, position.z);
    itemMesh.scale.set(size, size, size);
    itemMesh.itemId = itemId;
    itemMesh.itemType = itemType;
    itemMesh.outOfBounds = false;

    // check if object is within the bounds of the plane
    const objectBoundaries = new THREE.Box3().setFromObject(itemMesh);
    if (
      objectBoundaries.min.x > boundaries.width / 2 ||
      objectBoundaries.max.x < -boundaries.width / 2 ||
      objectBoundaries.min.z > boundaries.height / 2 ||
      objectBoundaries.max.z < -boundaries.height / 2
    ) {
      // if the object is outside the plane, mark it as out of bounds and return
      itemMesh.outOfBounds = true;
      return;
    }

    scene.add(itemMesh);
    itemMeshes[itemId] = itemMesh;
    return itemMesh;
  }

  const overlay = document.getElementById("overlay");
  overlay.remove();
}

// FIXME models passed as array?
function startGame(gameDuration, [boat, turtle]) {
  scene.environment = textureEquirec;

  const backgroundGeometry = new THREE.SphereBufferGeometry(100000, 100000, 24);
  const backgroundMaterial = new THREE.MeshBasicMaterial({ map: textureEquirec });
  const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
  scene.add(backgroundMesh);
  // backgroundMesh.position.set(0,0,0);

  // const audioLoader = new THREE.AudioListener();
  // audioLoader.load( '/assets/mixkit-motorboat-on-the-sea-1183.wav', function( buffer ) {
  //   sound.setBuffer( buffer );
  //   sound.setLoop( true );
  //   sound.setVolume( 0.5 );
  //   sound.play();
  // });

  const listener = new THREE.AudioListener();


  const playerMaterial = new THREE.MeshStandardMaterial({
    color: 0xa52a2a,
    roughness: 0.9,
    metalness: 0.1,
  });

  boat.position.set(0, 0, 0);
  boat.scale.set(1, 1, 1);
  boat.rotation.set(0, 0, 0);
  boat.castShadow = true;
  boat.receiveShadow = true;
  scene.add(boat);
  player = boat;

  // Setup the scene
  var camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.add(listener);



  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  window.addEventListener("resize", function () {
    var width = window.innerWidth;
    var height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });

  camera.add( listener );
  scene.add( camera );

  const waterGeometry = new THREE.PlaneGeometry(
    boundaries.width,
    boundaries.height
  );

   waterGeometry.rotateX(-Math.PI / 2);

  const waterMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x62b7a9, 
    opacity: 0.55,
    transparent: true 
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  scene.add(water);

  sendYourPosition = throttle(traceRateInMillis, false, () => {
    if (gameOverFlag) return;
    // FIXME don't send trace if no changes
    const { x, y, z } = player.position;
    const { x: rotX, y: rotY, z: rotZ } = player.rotation;
    const trace = {
      id: yourId,
      x: x.toFixed(5),
      z: z.toFixed(5),
      rotY: rotY.toFixed(5)
    };
    worker.postMessage({ type: "player.trace.change", body: trace });
  });

  const navmeshGeometry = new THREE.PlaneGeometry(89, 23);
  const navmeshMaterial = new THREE.MeshBasicMaterial({
    color: 0x0000ff, 
    opacity: 0.1,
    transparent: true,
    wireframe: true,
  });
  const navmesh = new THREE.Mesh(navmeshGeometry, navmeshMaterial);

  water.addEventListener("change", () => {
  navmesh.geometry = water.geometry.clone();
  navmesh.position.copy(water.position);
  });

  // Add the navmesh to the scene
  navmeshGeometry.rotateX(-Math.PI / 2);
  scene.add(navmesh);

  // Create a variable to store the remaining time
  remainingTime = gameDuration;
  var timerDiv = document.createElement("div");
  timerDiv.style.position = "absolute";
  timerDiv.style.top = "45px";
  timerDiv.style.left = "10px";
  timerDiv.style.color = "white";
  timerDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  timerDiv.innerHTML = "Time: " + remainingTime;
  document.body.appendChild(timerDiv);

  function updateTimer() {
    if (remainingTime > 0) {
      remainingTime--;
    }
    timerDiv.innerHTML = "Time: " + remainingTime;
    setTimeout(updateTimer, 1000);
  }

  // Start the timer
  updateTimer();

  function restart() {
    restartBtn.style.display = "none";

    for (const [key, mesh] of Object.entries(itemMeshes)) {
      scene.remove(mesh);
    }

    player.position.set(0, 0, 0);
    localScore = 0;

    scoreElement.innerHTML = "Score: " + localScore;

    remainingTime = remainingTime;
    timerDiv.innerHTML = "Time: " + remainingTime;

    updateTimer();
  }

  startTimer();

  var scoreElement = document.createElement("div");
  scoreElement.style.position = "absolute";
  scoreElement.style.top = "10px";
  scoreElement.style.left = "10px";
  scoreElement.style.color = "white";
  scoreElement.style.fontSize = "24px";
  scoreElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  scoreElement.innerHTML = "Score: " + localScore;
  document.body.appendChild(scoreElement);

  const floatAmplitude = 0.1;

  function animateItems() {
    const time = performance.now() * 0.001;
    for (const [key, mesh] of Object.entries(itemMeshes)) {
      if (!mesh.outOfBounds) {
        const sinValue = Math.sin(
          time * 2 + mesh.position.x * 0.5 + mesh.position.y * 0.3
        );
        mesh.position.z = sinValue * floatAmplitude;
      }
    }
  }

const ambientLight = new THREE.AmbientLight(0x404040, 7); 
scene.add(ambientLight);

const skyColor = 0xaaccff; 
const sunIntensity = 8; 
const directionalLight = new THREE.DirectionalLight(skyColor, sunIntensity);
directionalLight.position.set(1, 1, -1); 
scene.add(directionalLight);
const aboveWaterFogDensity = 0.001;
scene.fog = new THREE.FogExp2(skyColor, aboveWaterFogDensity);

document.addEventListener("keydown", function (event) {
    keyboard[event.code] = true;
  });
  document.addEventListener("keyup", function (event) {
    keyboard[event.code] = false;
  });

  let playerSpeed = 0;

  const navmeshBoundingBox = new THREE.Box3().setFromObject(navmesh);

  function checkCollisions() {
    const playerBox = new THREE.Box3().setFromObject(player);
    for (const [key, mesh] of Object.entries(itemMeshes)) {
      if (mesh.outOfBounds) {
        continue;
      }
      const itemMeshBox = new THREE.Box3().setFromObject(mesh);
      // FIXME use cannon.js or any physics engine
      const collision = playerBox.intersectsBox(itemMeshBox);
      if (collision) {
        // Remove the object from the scene and the itemMeshes
        const collisionData = {
          itemId: key,
          localScore,
          playerId: yourId,
          playerName: playerName,
        };
        worker.postMessage({
          type: "items.collision",
          body: collisionData,
        });
        scene.remove(mesh);
        isMarineLife(mesh.itemType) ? localScore-- : localScore++;
        scoreElement.innerHTML = "Score: " + localScore;
        delete itemMeshes[key];
      }
    }
  }

  function updatePlayerPosition() {
    if (!player || !water || gameOverFlag) {
      return;
    }
    const ACCELERATION = 0.005;
    const BRAKE = 0.1;
    const MAX_SPEED = 0.05;
    const TURN_SPEED = Math.PI / 180;
    let movement = new THREE.Vector3(0, 0, 0);
    if (keyboard["ArrowUp"]) {
      playerSpeed += ACCELERATION;
    } else if (keyboard["ArrowDown"]) {
      playerSpeed -= BRAKE;
    } else {
      playerSpeed *= 0.98; 
    }
    playerSpeed = Math.max(Math.min(playerSpeed, MAX_SPEED), -MAX_SPEED);

    if (keyboard["ArrowLeft"]) {
      player.rotation.y += TURN_SPEED;
    }
    if (keyboard["ArrowRight"]) {
      player.rotation.y -= TURN_SPEED;
    }

    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(
      player.quaternion
    );

    const CAMERA_DISTANCE = 4;
    const CAMERA_HEIGHT = 1.5;
    const SPRING_STRENGTH = 0.1;

    movement.copy(direction).multiplyScalar(playerSpeed);
    const lastPosition = player.position.clone();
    player.position.add(movement);

    const playerBoundingBox = new THREE.Box3().setFromObject(player);
    if (!playerBoundingBox.intersectsBox(navmeshBoundingBox)) {player.position.copy(lastPosition);}
    const targetCameraPosition = new THREE.Vector3();
    const sphericalCoords = new THREE.Spherical(CAMERA_DISTANCE, Math.PI / 2, player.rotation.y + Math.PI);
    targetCameraPosition.setFromSpherical(sphericalCoords);
    targetCameraPosition.y += CAMERA_HEIGHT;
    targetCameraPosition.add(player.position);
    camera.position.lerp(targetCameraPosition, SPRING_STRENGTH);
    camera.lookAt(player.position);
  }

  //player meshes id
  function animateOtherPlayers(playerMeshes) {
    if (!playerMeshes) return;
    Object.keys(playerMeshes).forEach((id) => {
      if (otherPlayers[id]) {
        playerMeshes[id].position.x = otherPlayers[id].x;
        playerMeshes[id].position.z = otherPlayers[id].z;
        playerMeshes[id].rotation.y = otherPlayers[id].rotY;
      }
    });
  }

  // Render the scene
  function animate() {
    requestAnimationFrame(animate);
    updatePlayerPosition();
    checkCollisions();
    renderer.render(scene, camera);
    animateItems();
    // traces
    sendYourPosition();
    logTrace(
      `Player on (${player.position.x.toFixed(2)}, ${player.position.z.toFixed(
        2, 
      )}) heading to ${player.rotation.y.toFixed(2)}`
    );
    animateOtherPlayers(otherPlayersMeshes);
  }
  animate();

  var light = new THREE.PointLight(0xffffff, 1, 1);
  light.position.set(0, 1, 0);
  player.add(light);
}

function isMarineLife(type) {
  switch (type) {
    case "turtle":
      return true;
    case "trash":
      return false;
    default:
      return false;
  }
}

function endGame() {
  worker.postMessage({ type: "close" });

  gameOverFlag = true; // Set the game over flag to true

  // Disable keyboard controls
  keyboard = {};

  // Remove all item meshes from the scene
  for (const [key, mesh] of Object.entries(itemMeshes)) {
    scene.remove(mesh);
  }

  // Display the player's score and name as a CSS overlay
  const scoreOverlay = document.createElement("div");
  scoreOverlay.id = "score-overlay";
  scoreOverlay.innerHTML = "Game Over";
  scoreOverlay.innerHTML += "<br>Name: " + playerName;
  scoreOverlay.innerHTML += "<br>Score: " + localScore;
  document.body.appendChild(scoreOverlay);

  // Create a restart button
  const restartBtn = document.createElement("button");
  restartBtn.innerHTML = "Restart";
  restartBtn.style.position = "absolute";
  restartBtn.style.top = "100px";
  restartBtn.style.left = "10px";
  restartBtn.addEventListener("click", function () {
    // Reload the page to restart the game
    window.location.reload();
  });
  document.body.appendChild(restartBtn);

  clearTimeout(timerId);
}

// Create a function to start the timer
function startTimer() {
  timerId = setTimeout(function () {
    // Display a message or trigger an event to indicate that time is up
  }, remainingTime * 1000);
}
