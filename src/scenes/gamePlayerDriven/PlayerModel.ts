import * as THREE from 'three'
import { GLTFLoader, Capsule, Octree } from 'three/examples/jsm/Addons.js'

/**
 * 玩家控制器类 - 角色主导模式的核心控制器
 * 在角色主导模式下，此类是主要的控制中心，负责：
 * 1. 处理玩家输入并转换为移动指令
 * 2. 管理角色的物理状态（碰撞、重力、速度）
 * 3. 控制3D模型的加载、位置和旋转
 * 4. 提供位置和状态信息给相机系统
 * 5. 独立的移动逻辑，不依赖相机方向
 */
export class PlayerModel {
  private player: THREE.Group<THREE.Object3DEventMap> | null = null
  private scene: THREE.Scene
  private loader: GLTFLoader
  private playerCollider: Capsule
  private playerVelocity: THREE.Vector3
  private playerOnFloor: boolean = false

  // 调试可视化
  private debugCapsule: THREE.Group | null = null
  private showDebug: boolean = true // 默认显示调试信息

  // 移动参数
  private groundSpeed: number = 25
  private airSpeed: number = 8
  private jumpForce: number = 15
  private dampingFactor: number = 4

  // 角色朝向和移动状态
  private playerDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1) // 角色面向方向
  private moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.loader = new GLTFLoader()
    this.loader.setPath('/models/gltf/')
    
    // 初始化玩家碰撞体
    this.playerCollider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.8, 0), 0.35)
    this.playerVelocity = new THREE.Vector3()
    
    // 创建调试可视化
    this.createDebugCapsule()
  }

  // === 调试可视化方法 ===
  
  /**
   * 创建Capsule的调试可视化
   */
  private createDebugCapsule(): void {
    if (!this.showDebug) return
    
    this.debugCapsule = new THREE.Group()
    
    // 创建胶囊体的圆柱部分
    const cylinderHeight = 1.8 - 2 * 0.35 // 总高度减去两个半球的直径
    const cylinderGeometry = new THREE.CylinderGeometry(0.35, 0.35, cylinderHeight, 8)
    const cylinderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.5 
    })
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
    cylinder.position.y = cylinderHeight / 2 + 0.35 // 调整位置到胶囊中心
    
    // 创建上半球
    const topSphereGeometry = new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.5 
    })
    const topSphere = new THREE.Mesh(topSphereGeometry, sphereMaterial)
    topSphere.position.y = 1.8 - 0.35 // 顶部位置
    
    // 创建下半球
    const bottomSphereGeometry = new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    const bottomSphere = new THREE.Mesh(bottomSphereGeometry, sphereMaterial)
    bottomSphere.position.y = 0.35 // 底部位置
    
    // 组合胶囊体
    this.debugCapsule.add(cylinder)
    this.debugCapsule.add(topSphere)
    this.debugCapsule.add(bottomSphere)
    
    // 添加到场景
    this.scene.add(this.debugCapsule)
  }

  /**
   * 更新调试可视化位置
   */
  private updateDebugCapsule(): void {
    if (!this.debugCapsule || !this.showDebug) return
    
    // 使用胶囊体的起始点（底部）作为调试胶囊体的位置
    const colliderBottomPosition = this.playerCollider.start.clone()
    this.debugCapsule.position.copy(colliderBottomPosition)
  }

  /**
   * 切换调试可视化显示
   */
  toggleDebugVisibility(): void {
    this.showDebug = !this.showDebug
    if (this.debugCapsule) {
      this.debugCapsule.visible = this.showDebug
    }
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
   * 更新模型位置和旋转（内部管理）
   */
  private updateModelTransform(): void {
    if (this.player) {
      // 使用胶囊体底部位置作为模型位置，与调试胶囊体保持一致
      const position = this.playerCollider.start.clone()
      this.player.position.copy(position)
      
      // 更新旋转到角色面向方向
      const rotation = Math.atan2(this.playerDirection.x, this.playerDirection.z)
      this.player.rotation.y = rotation
    }
    
    // 更新调试胶囊体位置
    this.updateDebugCapsule()
  }

  // === 输入处理方法（角色主导模式的核心）===
  
  /**
   * 更新移动状态
   */
  updateMovementState(keyStates: Record<string, boolean>): void {
    this.moveState.forward = keyStates['KeyW']
    this.moveState.backward = keyStates['KeyS']
    this.moveState.left = keyStates['KeyA']
    this.moveState.right = keyStates['KeyD']
    this.moveState.jump = keyStates['Space']
  }
  
  /**
   * 处理移动输入（角色主导模式）
   */
  processMovement(deltaTime: number): void {
    const speedDelta = deltaTime * (this.playerOnFloor ? this.groundSpeed : this.airSpeed)
    
    // 首先处理左右转向（A/D键直接控制角色朝向）
    const rotationSpeed = 1.5 * deltaTime // 降低转向速度，减少眩晕感
    
    if (this.moveState.left) {
      // A键：向左转
      const rotationMatrix = new THREE.Matrix4()
      rotationMatrix.makeRotationY(rotationSpeed)
      this.playerDirection.applyMatrix4(rotationMatrix)
      this.playerDirection.normalize()
    }
    
    if (this.moveState.right) {
      // D键：向右转
      const rotationMatrix = new THREE.Matrix4()
      rotationMatrix.makeRotationY(-rotationSpeed)
      this.playerDirection.applyMatrix4(rotationMatrix)
      this.playerDirection.normalize()
    }
    
    // 然后处理前后移动（W/S键沿当前朝向移动）
    let moveDirection = new THREE.Vector3()
    let hasMovement = false
    
    if (this.moveState.forward) {
      // W键：向前移动
      moveDirection.add(this.playerDirection)
      hasMovement = true
    }
    
    if (this.moveState.backward) {
      // S键：向后移动
      moveDirection.sub(this.playerDirection)
      hasMovement = true
    }
    
    // 应用移动
    if (hasMovement) {
      moveDirection.normalize()
      moveDirection.y = 0 // 保持在水平面
      this.playerVelocity.add(moveDirection.multiplyScalar(speedDelta))
    }
    
    // 处理跳跃
    if (this.moveState.jump) {
      this.executeJump()
    }
  }

  /**
   * 处理鼠标旋转输入（可选的角色旋转控制）
   */
  handleRotationInput(deltaX: number): void {
    const rotationSpeed = 0.002
    const angle = -deltaX * rotationSpeed
    
    // 旋转角色朝向
    this.playerDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    this.playerDirection.normalize()
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
   * 更新玩家物理状态和模型表现
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
    
    // 更新模型的位置和旋转
    this.updateModelTransform()
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
   * @deprecated 在角色主导模式下，位置由内部管理
   */
  updatePosition(position: THREE.Vector3): void {
    console.warn('updatePosition is deprecated in character-driven mode')
  }

  /**
   * @deprecated 在角色主导模式下，旋转由内部管理
   */
  updateRotation(rotation: number): void {
    console.warn('updateRotation is deprecated in character-driven mode')
  }

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
   * 获取角色朝向方向
   */
  getDirection(): THREE.Vector3 {
    return this.playerDirection.clone()
  }

  /**
   * 获取角色位置（用于相机跟随）
   */
  getPosition(): THREE.Vector3 {
    return this.getColliderPosition()
  }

  /**
   * 获取角色旋转角度
   */
  getRotation(): number {
    return Math.atan2(this.playerDirection.x, this.playerDirection.z)
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