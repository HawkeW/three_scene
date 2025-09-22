import * as THREE from 'three'
import { PlayerModel } from './PlayerModel'

/**
 * 相机主导模式的相机控制器
 * 在此模式下，相机是主要的控制中心，负责：
 * 1. 处理输入并转换为移动指令
 * 2. 管理相机位置和旋转
 * 3. 计算角色的目标位置和朝向
 * 4. 提供统一的控制接口
 */
export class PlayerCamera {
  private camera: THREE.PerspectiveCamera
  private playerModel: PlayerModel
  
  // 相机控制参数
  private mouseSensitivity: number = 500
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 0.8, 0)
  
  // 移动状态
  private moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
  }

  constructor(camera: THREE.PerspectiveCamera, playerModel: PlayerModel) {
    this.camera = camera
    this.playerModel = playerModel
  }

  // === 相机控制方法 ===
  
  /**
   * 更新相机位置到玩家碰撞体位置
   */
  updateCameraPosition(): void {
    this.camera.position.copy(this.playerModel.getColliderPosition())
  }

  /**
   * 处理鼠标移动，更新相机旋转
   */
  handleMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement === document.body) {
      this.camera.rotation.y -= event.movementX / this.mouseSensitivity
      this.camera.rotation.x -= event.movementY / this.mouseSensitivity
      
      // 限制垂直旋转角度，防止翻转
      this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x))
    }
  }

  /**
   * 重置相机旋转
   */
  resetCameraRotation(): void {
    this.camera.rotation.set(0, 0, 0)
  }

  // === 输入处理方法 ===
  
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
   * 设置移动状态
   */
  setMoveState(direction: 'forward' | 'backward' | 'left' | 'right' | 'jump', active: boolean): void {
    this.moveState[direction] = active
  }

  /**
   * 处理键盘输入并执行相应的移动
   */
  processMovement(keyStates: Record<string, boolean>, deltaTime: number): void {
    // 更新移动状态
    this.updateMovementState(keyStates)
    
    // 执行移动
    const cameraDirection = this.getCameraDirection()
    const cameraUp = this.camera.up

    if (this.moveState.forward) {
      this.playerModel.executeForwardMovement(deltaTime, cameraDirection)
    }

    if (this.moveState.backward) {
      this.playerModel.executeBackwardMovement(deltaTime, cameraDirection)
    }

    if (this.moveState.left) {
      this.playerModel.executeLeftMovement(deltaTime, cameraDirection, cameraUp)
    }

    if (this.moveState.right) {
      this.playerModel.executeRightMovement(deltaTime, cameraDirection, cameraUp)
    }

    if (this.moveState.jump) {
      this.playerModel.executeJump()
      this.moveState.jump = false // 跳跃是一次性动作
    }
  }

  // === 计算方法 ===
  
  /**
   * 获取相机方向向量（水平面）
   */
  getCameraDirection(): THREE.Vector3 {
    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction)
    direction.y = 0 // 保持在同一水平面
    direction.normalize()
    return direction
  }

  /**
   * 获取相机右侧方向向量
   */
  getCameraSideDirection(): THREE.Vector3 {
    const direction = this.getCameraDirection()
    direction.cross(this.camera.up)
    return direction
  }

  /**
   * 计算角色应该站立的位置（相机前方）
   */
  getPlayerTargetPosition(): THREE.Vector3 {
    const colliderPosition = this.playerModel.getColliderPosition().clone().sub(this.cameraOffset)
    return colliderPosition.clone()
  }

  /**
   * 计算角色应该面向的旋转角度
   */
  getPlayerTargetRotation(): number {
    const cameraDirection = this.getCameraDirection()
    return Math.atan2(cameraDirection.x, cameraDirection.z) + Math.PI
  }

  /**
   * 更新角色的视觉表现（位置和旋转）
   */
  updatePlayerVisuals(): void {
    if (this.playerModel.isLoaded()) {
      const targetPosition = this.getPlayerTargetPosition()
      const targetRotation = this.getPlayerTargetRotation()
      
      this.playerModel.updatePosition(targetPosition)
      this.playerModel.updateRotation(targetRotation)
    }
  }

  /**
   * 同步玩家模型的位置和旋转
   * 在相机主导模式下，由相机系统统一管理模型的视觉表现
   */
  syncPlayerModel(): void {
    if (this.playerModel.isLoaded()) {
      const playerPosition = this.getPlayerTargetPosition()
      const playerRotation = this.getPlayerTargetRotation()
      
      this.playerModel.updatePosition(playerPosition)
      this.playerModel.updateRotation(playerRotation)
    }
  }

  /**
   * 重置到安全位置
   * 用于传送玩家时的统一处理
   */
  resetToSafePosition(): void {
    // 重置相机旋转
    this.resetCameraRotation()
    
    // 更新相机位置
    this.updateCameraPosition()
    
    // 同步玩家模型到安全位置
    if (this.playerModel.isLoaded()) {
      const safePosition = this.getPositionInFrontOfCamera(1)
      const safeRotation = this.getPlayerRotationFromCamera()
      
      this.playerModel.updatePosition(safePosition)
      this.playerModel.updateRotation(safeRotation)
    }
  }

  // === 配置方法 ===
  
  /**
   * 设置鼠标灵敏度
   */
  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity
  }

  /**
   * 设置相机偏移
   */
  setCameraOffset(offset: THREE.Vector3): void {
    this.cameraOffset.copy(offset)
  }

  // === 兼容性方法（保持向后兼容）===
  
  /**
   * @deprecated 使用 getPlayerTargetPosition() 替代
   */
  getPositionInFrontOfCamera(distance: number = 1): THREE.Vector3 {
    return this.getPlayerTargetPosition()
  }

  /**
   * @deprecated 使用 getPlayerTargetRotation() 替代
   */
  getPlayerRotationFromCamera(): number {
    return this.getPlayerTargetRotation()
  }
}