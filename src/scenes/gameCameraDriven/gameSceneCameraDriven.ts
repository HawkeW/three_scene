import * as THREE from 'three'
import { SceneConfig } from "../../types/scene"
import { GLTFLoader, Octree, OctreeHelper } from 'three/examples/jsm/Addons.js'
import { PlayerModel } from './PlayerModel'
import { PlayerCamera } from './PlayerCamera'

export function createGameSceneCameraDriven(container: HTMLElement): SceneConfig {
  // 创建场景
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x222222)
  scene.fog = new THREE.Fog(0x88ccee, 0, 50);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.rotation.order = 'YXZ';

  const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
  fillLight1.position.set(2, 1, 1);
  scene.add(fillLight1);

    const axes = new THREE.AxesHelper(10);
  scene.add(axes);

  const worldOctree = new Octree();

  // 加载世界模型
  const loader = new GLTFLoader()
  loader.setPath('/models/gltf/')
  loader.load(
    'collision-world.glb',
    (gltf) => {
      scene.add(gltf.scene)
      worldOctree.fromGraphNode(gltf.scene);

      gltf.scene.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).map) {
            const material = mesh.material as THREE.MeshStandardMaterial
            if (material.map) {
              material.map.anisotropy = 4
            }
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

  // 初始化玩家相关组件
  const playerModel = new PlayerModel(scene);
  const playerCamera = new PlayerCamera(camera, playerModel);

  // 加载玩家模型
  playerModel.loadModel().catch(error => {
    console.error('玩家模型加载失败:', error);
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(render);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const clock = new THREE.Clock();
  const STEPS_PER_FRAME = 5;
  const GRAVITY = 30;

  let mouseTime = 0
  const keyStates: Record<string, boolean> = {};

  function render() {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      controls(deltaTime);
      updatePlayer(deltaTime);
      updateSpheres(deltaTime);
      teleportPlayerIfOob();
    }

    renderer.render(scene, camera);
  }

  /**
   * 相机主导模式的控制函数
   * 由相机系统统一处理输入并指挥角色移动
   */
  function controls(deltaTime: number) {
    // 使用相机主导模式的统一移动处理，传递keyStates
    playerCamera.processMovement(keyStates, deltaTime)
  }

  /**
   * 相机主导模式的玩家更新函数
   * 相机系统负责统一管理玩家状态和位置同步
   */
  function updatePlayer(deltaTime: number) {
    // 更新玩家物理状态
    playerModel.updatePhysics(deltaTime, GRAVITY)
    
    // 碰撞检测
    playerModel.checkCollisions(worldOctree)

    // 相机系统统一更新（包含相机位置和玩家模型同步）
    playerCamera.updateCameraPosition()
    
    // 同步玩家模型的视觉表现（如果模型已加载）
    if (playerModel.isLoaded()) {
      playerCamera.syncPlayerModel()
    }
  }

  function updateSpheres(deltaTime: number) {
  }

  /**
   * 传送玩家到安全位置（相机主导模式）
   */
  function teleportPlayerIfOob() {
    if (playerModel.getColliderPosition().y <= -25) {
      // 重置玩家物理状态
      playerModel.resetPosition()
      
      // 相机系统统一处理传送逻辑
      playerCamera.resetToSafePosition()
      
      // 同步玩家模型（如果已加载）
      if (playerModel.isLoaded()) {
        playerCamera.syncPlayerModel()
      }
    }
  }

  // 处理窗口大小变化
  function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // 事件监听
  document.addEventListener('keydown', (event) => {
    keyStates[event.code] = true;
  });

  document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
  });

  container.addEventListener('mousedown', () => {
    document.body.requestPointerLock();
    mouseTime = performance.now();
  })

  document.body.addEventListener('mousemove', (event) => {
    playerCamera.handleMouseMove(event);
  });

  return { scene, camera, renderer, animate: render, handleResize, name: 'gameScene', description: '游戏场景' }
}