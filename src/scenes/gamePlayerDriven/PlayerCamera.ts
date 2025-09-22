import * as THREE from 'three'
import { PlayerModel } from './PlayerModel'

/**
 * 跟随相机系统 - 角色主导模式的相机控制器
 * 在角色主导模式下，相机系统专注于：
 * 1. 跟随角色位置和朝向
 * 2. 提供平滑的视觉反馈
 * 3. 处理相机碰撞和避让
 * 4. 管理不同的相机状态和视角
 * 5. 响应鼠标输入进行视角调整
 */
export class PlayerCamera {
  private camera: THREE.PerspectiveCamera
  private playerModel: PlayerModel
  
  // 相机跟随参数
  private followDistance: number = 5
  private followHeight: number = 2
  private followSpeed: number = 5
  private rotationSpeed: number = 3
  
  // 相机状态
  private cameraAngleY: number = 0 // 水平旋转角度
  private cameraAngleX: number = 0.3 // 垂直旋转角度
  private mouseSensitivity: number = 0.001 // 降低鼠标灵敏度，减少眩晕感
  
  // 目标位置和当前位置
  private targetPosition: THREE.Vector3 = new THREE.Vector3()
  private targetLookAt: THREE.Vector3 = new THREE.Vector3()

  constructor(camera: THREE.PerspectiveCamera, playerModel: PlayerModel) {
    this.camera = camera
    this.playerModel = playerModel
  }

  // === 相机跟随方法 ===
  
  /**
   * 更新相机跟随角色
   */
  update(deltaTime: number): void {
    if (!this.playerModel.isLoaded()) return
    
    // 获取角色位置和朝向
    const playerPosition = this.playerModel.getPosition()
    const playerDirection = this.playerModel.getDirection()
    
    // 计算相机目标位置（角色后方）
    this.calculateTargetPosition(playerPosition, playerDirection)
    
    // 平滑移动相机到目标位置
    this.camera.position.lerp(this.targetPosition, this.followSpeed * deltaTime)
    
    // 计算相机观察点（角色位置稍微向上）
    this.targetLookAt.copy(playerPosition)
    this.targetLookAt.y += this.followHeight * 0.5
    
    // 相机直接看向角色位置
    this.camera.lookAt(this.targetLookAt)
  }

  /**
   * 计算相机目标位置
   */
  private calculateTargetPosition(playerPosition: THREE.Vector3, playerDirection: THREE.Vector3): void {
    // 基于相机角度计算位置
    const horizontalDistance = this.followDistance * Math.cos(this.cameraAngleX)
    const verticalOffset = this.followDistance * Math.sin(this.cameraAngleX)
    
    // 计算相机在角色后方的位置
    const cameraOffset = new THREE.Vector3()
    cameraOffset.x = -playerDirection.x * horizontalDistance
    cameraOffset.z = -playerDirection.z * horizontalDistance
    cameraOffset.y = this.followHeight + verticalOffset
    
    // 应用水平旋转
    const rotationMatrix = new THREE.Matrix4()
    rotationMatrix.makeRotationY(this.cameraAngleY)
    cameraOffset.applyMatrix4(rotationMatrix)
    
    this.targetPosition.copy(playerPosition).add(cameraOffset)
  }

  /**
   * 处理鼠标移动，更新相机角度
   */
  handleMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement === document.body) {
      this.cameraAngleY -= event.movementX * this.mouseSensitivity
      this.cameraAngleX -= event.movementY * this.mouseSensitivity
      
      // 限制垂直旋转角度，避免看天
      // 允许向下看60度，向上看最多15度
      this.cameraAngleX = Math.max(-Math.PI / 3, Math.min(Math.PI / 12, this.cameraAngleX))
    }
  }

  /**
   * 重置相机角度
   */
  resetCameraAngles(): void {
    this.cameraAngleY = 0
    this.cameraAngleX = 0.1 // 稍微向下倾斜，避免看天
  }

  // === 配置方法 ===
  
  /**
   * 设置跟随距离
   */
  setFollowDistance(distance: number): void {
    this.followDistance = distance
  }

  /**
   * 设置跟随高度
   */
  setFollowHeight(height: number): void {
    this.followHeight = height
  }

  /**
   * 设置跟随速度
   */
  setFollowSpeed(speed: number): void {
    this.followSpeed = speed
  }

  /**
   * 设置鼠标灵敏度
   */
  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity
  }

  // === 兼容性方法（保持向后兼容）===
  
  /**
   * @deprecated 在角色主导模式下使用 update() 方法
   */
  updateCameraPosition(): void {
    console.warn('updateCameraPosition is deprecated, use update() instead')
  }

  /**
   * @deprecated 在角色主导模式下使用 resetCameraAngles() 方法
   */
  resetCameraRotation(): void {
    this.resetCameraAngles()
  }

  /**
   * @deprecated 角色主导模式下不再需要此方法
   */
  updateMovementState(keyStates: Record<string, boolean>): void {
    console.warn('updateMovementState is deprecated in character-driven mode')
  }

  /**
   * @deprecated 角色主导模式下不再需要此方法
   */
  processMovement(keyStates: Record<string, boolean>, deltaTime: number): void {
    console.warn('processMovement is deprecated in character-driven mode')
  }

  /**
   * @deprecated 角色主导模式下不再需要此方法
   */
  syncPlayerModel(): void {
    console.warn('syncPlayerModel is deprecated in character-driven mode')
  }

  /**
   * @deprecated 角色主导模式下不再需要此方法
   */
  resetToSafePosition(): void {
    console.warn('resetToSafePosition is deprecated in character-driven mode')
  }
}