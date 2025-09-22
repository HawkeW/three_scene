import * as THREE from 'three'
import { SceneConfig } from "../../types/scene"
import { GLTFLoader, Octree, OctreeHelper } from 'three/examples/jsm/Addons.js'
import { PlayerModel } from './PlayerModel'
import { PlayerCamera } from './PlayerCamera'

export function createGameScenePlayerDriven(container: HTMLElement): SceneConfig {
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
   * 角色主导模式的控制函数
   * 角色控制器处理输入并独立移动，相机系统跟随角色
   */
  function controls(deltaTime: number) {
    // 更新角色的移动状态
    playerModel.updateMovementState(keyStates)
    
    // 角色处理移动逻辑
    playerModel.processMovement(deltaTime)
  }

  /**
   * 角色主导模式的更新函数
   * 角色独立更新，相机跟随角色
   */
  function updatePlayer(deltaTime: number) {
    // 更新角色物理状态和模型表现
    playerModel.updatePhysics(deltaTime, GRAVITY)
    
    // 碰撞检测
    playerModel.checkCollisions(worldOctree)

    // 相机跟随角色更新
    playerCamera.update(deltaTime)
  }

  function updateSpheres(deltaTime: number) {
  }

  /**
   * 传送玩家到安全位置（角色主导模式）
   */
  function teleportPlayerIfOob() {
    if (playerModel.getColliderPosition().y <= -25) {
      // 重置角色物理状态和位置
      playerModel.resetPosition()
      
      // 重置相机角度
      playerCamera.resetCameraAngles()
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
    // 角色主导模式：鼠标控制相机视角和角色旋转
    playerCamera.handleMouseMove(event)
    
    // 可选：让角色也响应鼠标旋转（用于更精确的控制）
    if (document.pointerLockElement === document.body) {
      playerModel.handleRotationInput(event.movementX)
    }
  })

  return { scene, camera, renderer, animate: render, handleResize, name: 'gameScene', description: '游戏场景' }
}