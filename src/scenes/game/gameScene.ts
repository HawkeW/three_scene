import * as THREE from 'three'
import { SceneConfig } from "../../types/scene"
import { Capsule, GLTFLoader, Octree, OctreeHelper } from 'three/examples/jsm/Addons.js'

export function createGameScene(container: HTMLElement): SceneConfig {
  // 创建场景
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x222222)
  scene.fog = new THREE.Fog(0x88ccee, 0, 50);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.rotation.order = 'YXZ';

  const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
  fillLight1.position.set(2, 1, 1);
  scene.add(fillLight1);

  const worldOctree = new Octree();

  // 加载模型
  const loader = new GLTFLoader()
  loader.setPath('/models/gltf/')
  loader.load(
    'collision-world.glb',
    (gltf) => {
      scene.add(gltf.scene)
      worldOctree.fromGraphNode(gltf.scene);

      gltf.scene.traverse(child => {

        if (child.isMesh) {

          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material.map) {

            child.material.map.anisotropy = 4;

          }

        }

      });

      const helper = new OctreeHelper(worldOctree);
      helper.visible = false;
      scene.add(helper);
    },
    undefined,
    (error) => {
      console.error('模型加载失败:', error)
    }
  )

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const clock = new THREE.Clock();
  const STEPS_PER_FRAME = 5;
  const GRAVITY = 30;

  let playerOnFloor = false
  let mouseTime = 0
  const keyStates: Record<string, boolean> = {};
  const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);

  const playerVelocity = new THREE.Vector3();
  const playerDirection = new THREE.Vector3();

  function getForwardVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();

    return playerDirection;
  }

  function getSideVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);

    return playerDirection;
  }

  function animate() {

    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    // we look for collisions in substeps to mitigate the risk of
    // an object traversing another too quickly for detection.

    for (let i = 0; i < STEPS_PER_FRAME; i++) {

      controls(deltaTime);

      updatePlayer(deltaTime);

      updateSpheres(deltaTime);

      teleportPlayerIfOob();
    }

    renderer.render(scene, camera);

  }

  function controls(deltaTime: number) {

    // gives a bit of air control
    const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

    if (keyStates['KeyW']) {

      playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));

    }

    if (keyStates['KeyS']) {

      playerVelocity.add(getForwardVector().multiplyScalar(- speedDelta));

    }

    if (keyStates['KeyA']) {

      playerVelocity.add(getSideVector().multiplyScalar(- speedDelta));

    }

    if (keyStates['KeyD']) {

      playerVelocity.add(getSideVector().multiplyScalar(speedDelta));

    }

    if (playerOnFloor) {

      if (keyStates['Space']) {

        playerVelocity.y = 15;

      }

    }

  }

  function playerCollisions() {
    const result = worldOctree.capsuleIntersect(playerCollider);

    playerOnFloor = false;

    if (result) {

      playerOnFloor = result.normal.y > 0;

      if (!playerOnFloor) {

        playerVelocity.addScaledVector(result.normal, - result.normal.dot(playerVelocity));

      }

      if (result.depth >= 1e-10) {

        playerCollider.translate(result.normal.multiplyScalar(result.depth));

      }
    }
  }

  function updatePlayer(deltaTime: number) {

    let damping = Math.exp(- 4 * deltaTime) - 1;

    if (!playerOnFloor) {

      playerVelocity.y -= GRAVITY * deltaTime;

      // small air resistance
      damping *= 0.1;

    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);

    playerCollisions();

    camera.position.copy(playerCollider.end);
  }


  function updateSpheres(deltaTime: number) {
  }

  function teleportPlayerIfOob() {
    if (camera.position.y <= - 25) {

      playerCollider.start.set(0, 0.35, 0);
      playerCollider.end.set(0, 1, 0);
      playerCollider.radius = 0.35;
      camera.position.copy(playerCollider.end);
      camera.rotation.set(0, 0, 0);

    }
  }

  // 处理窗口大小变化
  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  document.addEventListener('keydown', (event) => {

    keyStates[event.code] = true;

  });

  document.addEventListener('keyup', (event) => {

    keyStates[event.code] = false;

  });

  container.addEventListener( 'mousedown', () => {

    document.body.requestPointerLock();

    mouseTime = performance.now();

  })

  document.body.addEventListener('mousemove', (event) => {

    if (document.pointerLockElement === document.body) {

      camera.rotation.y -= event.movementX / 500;
      camera.rotation.x -= event.movementY / 500;
    }

  });

  return { scene, camera, renderer, animate, handleResize, name: 'gameScene', description: '游戏场景' }
}