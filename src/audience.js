/*
This example uses the OrbitControls addon by importing it separately from the main THREE codebase.

*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { Quotes } from './quotes.js';
import { Flow } from 'three/addons/modifiers/CurveModifier.js';
import { FirstPersonControls } from './libs/FirstPersonControls.js';

let scene, camera, renderer, controls, font, flow;
let imageDisplays = [];
let socket;
let mediasoupPeer;
let clock;

let textDisplays = [];

function init() {
  // initialize scene stuff
  console.log('~~~~~~~~~~~~~~~~~');

  // hack to prevent issue where we've been scrolled below content...
  window.scrollTo(0, 0);

  if (window.location.hostname === 'venue.dftp.live') {
    socket = io('https://venue.dftp.live');
  } else {
    socket = io('http://localhost:3131');
  }

  socket.on('sceneIdx', (data) => {
    console.log('SceneIdx:', data);
    setScene(data);
  });

  mediasoupPeer = new SimpleMediasoupPeer(socket);
  mediasoupPeer.on('track', gotTrack);

  // create a scene in which all other objects will exist
  scene = new THREE.Scene();

  clock = new THREE.Clock();

  // create a camera and position it in space
  let aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.z = 5; // place the camera in space
  camera.position.y = 1;
  camera.lookAt(0, 1, 0);

  // the renderer will actually show the camera view within our <canvas>
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const container = document.getElementById('canvasContainer');
  container.appendChild(renderer.domElement);

  //
  let gridHelper = new THREE.GridHelper(25, 25);
  scene.add(gridHelper);

  // add orbit controls
  // let controls = new OrbitControls(camera, renderer.domElement);
  // controls = new FlyControls(camera, renderer.domElement);
  // controls.movementSpeed = 1.5;
  // controls.domElement = renderer.domElement;
  // controls.rollSpeed = 0;
  // controls.autoForward = false;
  // controls.dragToLook = true;
  controls = new FirstPersonControls(scene, camera, renderer);

  loop();

  // call our function to get and display images from an API
  // getDataAndDisplay();

  loadFont();
}

function loadFont() {
  const loader = new FontLoader();
  loader.load('poppins-medium-regular-font.json', function (response) {
    font = response;

    refreshText();
  });
}
function getRandomPoints(numPoints = 100, scale = 10) {
  const points = [];
  for (let i = 0; i < 100; i++) {
    points.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale,
        (Math.random() - 0.5) * scale
      )
    );
  }
  return points;
}
function generateHelixPoints(radius, turns, height, numPoints = 10) {
  const points = [];
  const initialRadius = radius;

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / (numPoints - 1)) * 2 * turns * Math.PI;
    radius = initialRadius - (initialRadius / numPoints) * i; // Decrease radius for each turn
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const z = (i / (numPoints - 1)) * height;
    points.push(new THREE.Vector3(x, z, y));
  }

  return points;
}

class TextDisplay {
  constructor(textToDisplay, font, scene,color,rootPosition, style=0) {
    this.scene = scene;
    let textGeo = new TextGeometry(textToDisplay, {
      font: font,

      size: 0.125,
      height: 0.02,
      curveSegments: 2,

      bevelThickness: 0,
      bevelSize: 0,
      bevelEnabled: false,
    });

    let textMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });

    this.mesh = new THREE.Mesh(textGeo, textMat);
    this.mesh.position.set(rootPosition.x,rootPosition.y,rootPosition.z);
    this.scene.add(this.mesh);

    // also add crazy curve display
    this.alteredMesh = this.mesh.clone();

    const length = textToDisplay.length * 0.1;
    const depth = textToDisplay.length * 0.1;
    let points = [];
    if (style === 0) points = generateHelixPoints(3, length, depth, 20);
    if (style === 1) points = getRandomPoints(200,5);
    if (style === 2) points = getRandomPoints(50,0.5);
    console.log(points);

    const curve = new THREE.CatmullRomCurve3(points);
    curve.curveType = 'centripetal';
    curve.closed = true;

    this.speed = Math.random() * 0.5;

    this.flow = new Flow(this.alteredMesh);
    this.flow.updateCurve(0, curve);

    this.scene.add(this.flow.object3D);
  }

  update(delta){
    this.flow.moveAlongCurve(delta * this.speed);
  }
}
let tm;

function refreshText() {
  console.log(font);

  Quotes.forEach((q, i) => {
    textDisplays.push(new TextDisplay(q,font,scene, new THREE.Color(Math.random(),Math.random(),Math.random()),new THREE.Vector3(i*10,2,0),i));
  
  });
}
// this function gets data from the API and then adds new "MyImageDisplay" objects to the scene
// it is a special "asynchronous" function, which means it will wait for the data to be ready before continuing
async function getDataAndDisplay() {
  let artworkData = await getArtworkData('cat');

  console.log(artworkData);

  for (let i = 0; i < artworkData.length; i++) {
    // first we get the URL of the artwork
    let image_id = artworkData[i].data.image_id;
    let imageUrl =
      'https://www.artic.edu/iiif/2/' + image_id + '/full/843,/0/default.jpg';

    // then we create a new MyImageDisplay object and pass in the scene and the URL
    for (let q = 0; q < 10; q++) {
      let imageDisplay = new MyImageDisplay(scene, imageUrl);

      // then we set the location of the display
      imageDisplay.setPosition(i * 2, camera.position.y, q * 2); // arrange them in a line

      // finally, we add the imageDisplay to an array so we can acces it in our draw loop
      imageDisplays.push(imageDisplay);
    }
  }
}

// our draw loop
function loop() {

  const delta = clock.getDelta();
  for (let i = 0; i < textDisplays.length; i++){
    textDisplays[i].update(delta / 5);
  }
  // if (tm) tm.position.x -= 0.01;
  // do something to each image display
  for (let i = 0; i < imageDisplays.length; i++) {
    imageDisplays[i].doAction(0.01);
  }
  // finally, take a picture of the scene and show it in the <canvas>
  renderer.render(scene, camera);

  controls.update(delta);
  // ask our window to draw the next frame when it's ready
  window.requestAnimationFrame(loop);
}

// here we're using a class to encapsulate all of the code related to displaying an image
class MyImageDisplay {
  constructor(scene, imageUrl) {
    // load the image texture from the provided URL
    let imageTexture = new THREE.TextureLoader().load(imageUrl);

    // create geometry and material with texture
    let geo = new THREE.BoxGeometry(1, 1, 1);
    let mat = new THREE.MeshBasicMaterial({ map: imageTexture });
    let mesh = new THREE.Mesh(geo, mat);

    // save the mesh to 'this' object so we can access it elsewhere in the class
    this.mesh = mesh;

    // add it to the scene add add a position
    scene.add(mesh);
  }

  // a method which sets the position of the mesh
  setPosition(x, y, z) {
    this.mesh.position.x = x;
    this.mesh.position.y = y;
    this.mesh.position.z = z;
  }

  // a method which does something to the mesh
  doAction(amount) {
    // this.mesh.rotateX(amount);
    // this.mesh.rotateY(amount);
    // this.mesh.rotateZ(amount);
    this.mesh.lookAt(
      new THREE.Vector3(
        camera.position.x,
        this.mesh.position.y,
        camera.position.z
      )
    );
  }
}

window.onload = () => {
  document.getElementById('startButton').addEventListener('click', () => {
    const overlay = document.getElementById('overlay');
    overlay.classList.add('hidden');

    init();
  });
};

function setScene(data) {
  console.log('switching scene: ', data);
  const myFrame = document.getElementById('sceneContainer');

  myFrame.setAttribute('src', `../scenes/${data}-audience.html`);
  myFrame.style.pointerEvents = 'all';
}

//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//*//

function gotTrack(track, id, label) {
  console.log(`Got track of kind ${label} from ${id}`);

  let isBroadcast = label == 'video-broadcast' || label == 'audio-broadcast';

  let el = document.getElementById(id + '_' + label);

  if (isBroadcast && track.kind === 'video') {
    el = document.getElementById('broadcastVideo');
  }
  if (isBroadcast && track.kind === 'audio') {
    el = document.getElementById('broadcastAudio');
    el.volume = 1;
  }

  if (track.kind === 'video') {
    if (el == null) {
      console.log('Creating video element for client with ID: ' + id);
      el = document.createElement('video');
      el.id = id + '_video';
      el.autoplay = true;
      el.muted = true;
      el.setAttribute('playsinline', true);

      // el.style = "visibility: hidden;";
      document.body.appendChild(el);
    }
  }

  if (track.kind === 'audio') {
    if (el == null) {
      console.log('Creating audio element for client with ID: ' + id);
      el = document.createElement('audio');
      el.id = id + '_' + label;
      document.body.appendChild(el);
      el.setAttribute('playsinline', true);
      el.setAttribute('autoplay', true);
      el.volume = 0;
    }
  }

  el.srcObject = null;
  el.srcObject = new MediaStream([track]);

  el.onloadedmetadata = (e) => {
    el.play().catch((e) => {
      console.log('Play Error: ' + e);
    });
  };
}

export function getArtworkData(query) {
  return new Promise((resolve, reject) => {
    let url =
      'https://api.artic.edu/api/v1/artworks/search?q=' +
      query +
      '&query[term][is_public_domain]=true&limit=20';

    let image_id = '47c94f35-2c05-9eb2-4c3f-6c841724a0a1';
    let imageUrl =
      'https://www.artic.edu/iiif/2/' + image_id + '/full/843,/0/default.jpg';
    console.log(imageUrl);
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        console.log(json);
        let data = json.data;
        let promises = []; // Array to store promises
        for (let i = 0; i < data.length; i++) {
          let itemInfoUrl = data[i].api_link;
          // Push each fetch call's promise into the promises array
          promises.push(fetch(itemInfoUrl).then((res) => res.json()));
        }
        // Wait for all promises to resolve
        Promise.all(promises)
          .then((info) => {
            // Now you have all the image URLs
            resolve(info);
          })
          .catch((error) => {
            reject(error);
          });
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function createText(text) {
  let textGeo = new TextGeometry(text, {
    font: font,

    size: 0.25,
    height: 0.05,
    curveSegments: 2,

    bevelThickness: 0,
    bevelSize: 0,
    bevelEnabled: false,
  });

  let mesh = new THREE.Mesh(
    textGeo,
    new THREE.MeshBasicMaterial({ color: 'aliceblue' })
  );

  return mesh;
}