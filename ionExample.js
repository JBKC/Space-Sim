import { EnvironmentControls } from '3d-tiles-renderer/src/three/controls';
import { TilesRenderer } from '3d-tiles-renderer/src/three';
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin } from '3d-tiles-renderer/src/plugins/three';
import {
    Scene,
    WebGLRenderer,
    PerspectiveCamera,
    Vector3,
    Quaternion,
    Sphere,
    DataTexture,
    EquirectangularReflectionMapping
} from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, controls, scene, renderer, tiles;

const apiKey = localStorage.getItem('ionApiKey') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmM2NmMGU2Mi0zNDYxLTRhOTQtYmRiNi05Mzk0NTg4OTdjZDkiLCJpZCI6Mjg0MDk5LCJpYXQiOjE3NDE5MTI4Nzh9.ciqVryFsYbzdwKxd_nEANC8pHgU9ytlfylfpfy9Q56U';

const params = {
    ionAssetId: '75343',
    ionAccessToken: apiKey,
    reload: reinstantiateTiles,
};

init();
animate();

function rotationBetweenDirections(dir1, dir2) {
    const rotation = new Quaternion();
    const a = new Vector3().crossVectors(dir1, dir2);
    rotation.x = a.x;
    rotation.y = a.y;
    rotation.z = a.z;
    rotation.w = 1 + dir1.clone().dot(dir2);
    rotation.normalize();

    return rotation;
}

function setupTiles() {
    tiles.fetchOptions.mode = 'cors';
    tiles.registerPlugin(new GLTFExtensionsPlugin({
        dracoLoader: new DRACOLoader().setDecoderPath('./node_modules/three/examples/jsm/libs/draco/gltf/')
    }));
    scene.add(tiles.group);
}

function reinstantiateTiles() {
    if (tiles) {
        scene.remove(tiles.group);
        tiles.dispose();
        tiles = null;
    }

    localStorage.setItem('ionApiKey', params.ionAccessToken);

    tiles = new TilesRenderer();
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: params.ionAccessToken, assetId: params.ionAssetId }));
    tiles.addEventListener('load-tile-set', () => {
        const sphere = new Sphere();
        tiles.getBoundingSphere(sphere);

        const position = sphere.center.clone();
        const distanceToEllipsoidCenter = position.length();

        const surfaceDirection = position.normalize();
        const up = new Vector3(0, 1, 0);
        const rotationToNorthPole = rotationBetweenDirections(surfaceDirection, up);

        tiles.group.quaternion.x = rotationToNorthPole.x;
        tiles.group.quaternion.y = rotationToNorthPole.y;
        tiles.group.quaternion.z = rotationToNorthPole.z;
        tiles.group.quaternion.w = rotationToNorthPole.w;

        tiles.group.position.y = -distanceToEllipsoidCenter;
    });

    setupTiles();
}

function init() {
    scene = new Scene();

    const env = new DataTexture(new Uint8Array(64 * 64 * 4).fill(255), 64, 64);
    env.mapping = EquirectangularReflectionMapping;
    env.needsUpdate = true;
    scene.environment = env;

    renderer = new WebGLRenderer({ antialias: true });
    renderer.setClearColor(0x151c1f);

    document.body.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 1;

    camera = new PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        1,
        100000
    );
    camera.position.set(100, 100, -100);
    camera.lookAt(0, 0, 0);

    controls = new EnvironmentControls(scene, camera, renderer.domElement);
    controls.adjustHeight = false;
    controls.minDistance = 1;
    controls.maxAltitude = Math.PI;

    reinstantiateTiles();

    onWindowResize();
    window.addEventListener('resize', onWindowResize, false);

    const gui = new GUI();
    gui.width = 300;

    const ionOptions = gui.addFolder('Ion');
    ionOptions.add(params, 'ionAssetId');
    ionOptions.add(params, 'ionAccessToken');
    ionOptions.add(params, 'reload');
    ionOptions.open();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

function animate() {
    requestAnimationFrame(animate);

    if (!tiles) return;

    controls.update();

    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);

    camera.updateMatrixWorld();
    tiles.update();

    renderer.render(scene, camera);
}