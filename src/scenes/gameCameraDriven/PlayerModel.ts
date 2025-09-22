import * as THREE from 'three'
import { GLTFLoader, Capsule, Octree } from 'three/examples/jsm/Addons.js'

/**
 * 玩家模型类 - 相机主导模式下的角色实体
 * 在相机主导模式下，此类专注于：
 * 1. 物理状态管理（碰撞、重力、速度）
 * 2. 3D模型的加载和渲染
 * 3. 执行来自相机控制器的移动指令
 * 4. 提供位置和状态信息给相机系统
 */
export class PlayerModel {
  private player: THREE.Group<THREE.Object3DEventMap> | null = null
  private scene: THREE.Scene
  private loader: GLTFLoader
  private playerCollider: Capsule
  private playerVelocity: THREE.Vector3
  private playerOnFloor: boolean = false

  // 移动参数
  private groundSpeed: number = 25
  private airSpeed: number = 8
  private jumpForce: number = 15
  private dampingFactor: number = 4

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.loader = new GLTFLoader()
    this.loader.setPath('/models/gltf/')
    
    // 初始化玩家碰撞体
    this.playerCollider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.8, 0), 0.35)
    this.playerVelocity = new THREE.Vector3()
  }

  // === 模型加载和管理 ===

  async loadModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        'Soldier.glb',
        (gltf) => {
          this.player = gltf.scene
          this.player.rotation.y = Math.PI

          this.player.traverse((object) => {
            if ((object as THREE.SkinnedMesh).isMesh) {
              const mesh = object as THREE.SkinnedMesh

              if (object.name == 'vanguard_Mesh') {
                mesh.castShadow = true
                mesh.receiveShadow = true
                ;(mesh.material as THREE.MeshStandardMaterial).metalness = 1.0
                ;(mesh.material as THREE.MeshStandardMaterial).roughness = 0.2
                ;(mesh.material as THREE.MeshStandardMaterial).color.set(1, 1, 1)
                ;(mesh.material as THREE.MeshStandardMaterial).metalnessMap = (mesh.material as THREE.MeshStandardMaterial).map
              } else {
                ;(mesh.material as THREE.MeshStandardMaterial).metalness = 1
                ;(mesh.material as THREE.MeshStandardMaterial).roughness = 0
                ;(mesh.material as THREE.MeshStandardMaterial).transparent = true
                ;(mesh.material as THREE.MeshStandardMaterial).opacity = 0.8
                ;(mesh.material as THREE.MeshStandardMaterial).color.set(1, 1, 1)
              }
            }
          })

          this.scene.add(this.player)
          resolve()
        },
        undefined,
        (error) => {
          console.error('模型加载失败:', error)
          reject(error)
        }
      )
    })
  }

  /**
   * 更新模型位置（由相机控制器调用）
   */
  updatePosition(position: THREE.Vector3): void {
    if (this.player) {
      this.player.position.copy(position)
    }
  }

  /**
   * 更新模型旋转（由相机控制器调用）
   */
  updateRotation(rotation: number): void {
    if (this.player) {
      this.player.rotation.y = rotation
    }
  }

  // === 物理系统 ===

  /**
   * 移动玩家碰撞体
   */
  private translate(vec3: THREE.Vector3): void {
    this.playerCollider.translate(vec3)
  }

  /**
   * 碰撞检测
   */
  checkCollisions(worldOctree: Octree): void {
    const result = worldOctree.capsuleIntersect(this.playerCollider)
    this.playerOnFloor = false

    if (result) {
      this.playerOnFloor = result.normal.y > 0

      if (!this.playerOnFloor) {
        this.playerVelocity.addScaledVector(result.normal, -result.normal.dot(this.playerVelocity))
      }

      if (result.depth >= 1e-10) {
        this.translate(result.normal.multiplyScalar(result.depth))
      }
    }
  }

  /**
   * 更新玩家物理状态
   */
  updatePhysics(deltaTime: number, gravity: number): void {
    let damping = Math.exp(-this.dampingFactor * deltaTime) - 1

    if (!this.playerOnFloor) {
      this.playerVelocity.y -= gravity * deltaTime
      damping *= 0.1
    }

    this.playerVelocity.addScaledVector(this.playerVelocity, damping)

    const deltaPosition = this.playerVelocity.clone().multiplyScalar(deltaTime)
    this.translate(deltaPosition)
  }

  /**
   * 重置玩家位置（用于传送）
   */
  resetPosition(): void {
    this.playerCollider.start.set(0, 0, 0)
    this.playerCollider.end.set(0, 1.8, 0)
    this.playerCollider.radius = 0.35
    this.playerVelocity.set(0, 0, 0)
  }

  // === 移动指令执行（接收来自相机控制器的指令）===

  /**
   * 执行向前移动指令
   */
  executeForwardMovement(deltaTime: number, direction: THREE.Vector3): void {
    const speedDelta = deltaTime * (this.playerOnFloor ? this.groundSpeed : this.airSpeed)
    const forwardVector = direction.clone()
    forwardVector.y = 0
    forwardVector.normalize()
    this.playerVelocity.add(forwardVector.multiplyScalar(speedDelta))
  }

  /**
   * 执行向后移动指令
   */
  executeBackwardMovement(deltaTime: number, direction: THREE.Vector3): void {
    const speedDelta = deltaTime * (this.playerOnFloor ? this.groundSpeed : this.airSpeed)
    const forwardVector = direction.clone()
    forwardVector.y = 0
    forwardVector.normalize()
    this.playerVelocity.add(forwardVector.multiplyScalar(-speedDelta))
  }

  /**
   * 执行向左移动指令
   */
  executeLeftMovement(deltaTime: number, direction: THREE.Vector3, up: THREE.Vector3): void {
    const speedDelta = deltaTime * (this.playerOnFloor ? this.groundSpeed : this.airSpeed)
    const sideVector = direction.clone()
    sideVector.y = 0
    sideVector.normalize()
    sideVector.cross(up)
    this.playerVelocity.add(sideVector.multiplyScalar(-speedDelta))
  }

  /**
   * 执行向右移动指令
   */
  executeRightMovement(deltaTime: number, direction: THREE.Vector3, up: THREE.Vector3): void {
    const speedDelta = deltaTime * (this.playerOnFloor ? this.groundSpeed : this.airSpeed)
    const sideVector = direction.clone()
    sideVector.y = 0
    sideVector.normalize()
    sideVector.cross(up)
    this.playerVelocity.add(sideVector.multiplyScalar(speedDelta))
  }

  /**
   * 执行跳跃指令
   */
  executeJump(): void {
    if (this.playerOnFloor) {
      this.playerVelocity.y = this.jumpForce
    }
  }

  // === 兼容性方法（保持向后兼容）===

  /**
   * @deprecated 使用 executeForwardMovement() 替代
   */
  moveForward(deltaTime: number, cameraDirection: THREE.Vector3): void {
    this.executeForwardMovement(deltaTime, cameraDirection)
  }

  /**
   * @deprecated 使用 executeBackwardMovement() 替代
   */
  moveBackward(deltaTime: number, cameraDirection: THREE.Vector3): void {
    this.executeBackwardMovement(deltaTime, cameraDirection)
  }

  /**
   * @deprecated 使用 executeLeftMovement() 替代
   */
  moveLeft(deltaTime: number, cameraDirection: THREE.Vector3, cameraUp: THREE.Vector3): void {
    this.executeLeftMovement(deltaTime, cameraDirection, cameraUp)
  }

  /**
   * @deprecated 使用 executeRightMovement() 替代
   */
  moveRight(deltaTime: number, cameraDirection: THREE.Vector3, cameraUp: THREE.Vector3): void {
    this.executeRightMovement(deltaTime, cameraDirection, cameraUp)
  }

  /**
   * @deprecated 使用 executeJump() 替代
   */
  jump(): void {
    this.executeJump()
  }

  // === 状态查询方法 ===

  /**
   * 获取碰撞体位置
   */
  getColliderPosition(): THREE.Vector3 {
    return this.playerCollider.end.clone()
  }

  /**
   * 添加速度（用于外部力的施加）
   */
  addVelocity(velocity: THREE.Vector3): void {
    this.playerVelocity.add(velocity)
  }

  /**
   * 获取是否在地面
   */
  isOnFloor(): boolean {
    return this.playerOnFloor
  }

  /**
   * 获取当前速度
   */
  getVelocity(): THREE.Vector3 {
    return this.playerVelocity.clone()
  }

  /**
   * 获取模型对象
   */
  getModel(): THREE.Group<THREE.Object3DEventMap> | null {
    return this.player
  }

  /**
   * 检查模型是否已加载
   */
  isLoaded(): boolean {
    return this.player !== null
  }

  // === 配置方法 ===

  /**
   * 设置地面移动速度
   */
  setGroundSpeed(speed: number): void {
    this.groundSpeed = speed
  }

  /**
   * 设置空中移动速度
   */
  setAirSpeed(speed: number): void {
    this.airSpeed = speed
  }

  /**
   * 设置跳跃力度
   */
  setJumpForce(force: number): void {
    this.jumpForce = force
  }

  /**
   * 设置阻尼系数
   */
  setDampingFactor(factor: number): void {
    this.dampingFactor = factor
  }
}