/*
This example uses the OrbitControls addon by importing it separately from the main THREE codebase.

*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';

let scene, camera, renderer, controls;
let imageDisplays = [];
let socket;
let mediasoupPeer;
let clock;

function init() {
  // initialize scene stuff
  console.log('~~~~~~~~~~~~~~~~~');

  // hack to prevent issue where we've been scrolled below content...
  window.scrollTo(0, 0);

  if (window.location.hostname === 'venue.itp.io') {
    socket = io('https://venue.itp.io');
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
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const container = document.getElementById('canvasContainer');
  container.appendChild(renderer.domElement);

  //
  let gridHelper = new THREE.GridHelper(25, 25);
  scene.add(gridHelper);

  // add orbit controls
  // let controls = new OrbitControls(camera, renderer.domElement);
  controls = new FlyControls(camera, renderer.domElement);
  controls.movementSpeed = 1.5;
  controls.domElement = renderer.domElement;
  controls.rollSpeed = 0;
  controls.autoForward = false;
  controls.dragToLook = true;

  loop();

  // call our function to get and display images from an API
  getDataAndDisplay();
}

// this function gets data from the API and then adds new "MyImageDisplay" objects to the scene
// it is a special "asynchronous" function, which means it will wait for the data to be ready before continuing
async function getDataAndDisplay() {
  let artworkData = await getArtworkData('Brooklyn');

  console.log(artworkData);

  for (let i = 0; i < artworkData.length; i++) {
    // first we get the URL of the artwork
    let image_id = artworkData[i].data.image_id;
    let imageUrl =
      'https://www.artic.edu/iiif/2/' + image_id + '/full/843,/0/default.jpg';

    // then we create a new MyImageDisplay object and pass in the scene and the URL
    let imageDisplay = new MyImageDisplay(scene, imageUrl);

    // then we set the location of the display
    imageDisplay.setPosition(i * 2, 0, 0); // arrange them in a line

    // finally, we add the imageDisplay to an array so we can acces it in our draw loop
    imageDisplays.push(imageDisplay);
  }
}

// our draw loop
function loop() {
  // do something to each image display
  for (let i = 0; i < imageDisplays.length; i++) {
    imageDisplays[i].doAction(0.01);
  }
  // finally, take a picture of the scene and show it in the <canvas>
  renderer.render(scene, camera);

  const delta = clock.getDelta();
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
    document.getElementById('startButton').style.display = 'none';
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
      '&query[term][is_public_domain]=true';

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
