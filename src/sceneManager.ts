import { createGameScene } from './scenes/game'
import { createGameSceneCameraDriven } from './scenes/gameCameraDriven/gameSceneCameraDriven'
import type { SceneConfig, SceneCreator } from './types/scene'
import { createGameScenePlayerDriven } from './scenes/gamePlayerDriven'

export class SceneManager {
  private scenes: SceneCreator[]
  private currentSceneIndex: number
  private currentScene: SceneConfig | null
  private animationId: number | null
  private sceneInfo: HTMLDivElement | null

  constructor() {
    this.scenes = [
      createGameScenePlayerDriven,
      createGameSceneCameraDriven,
      createGameScene,
    ]
    this.currentSceneIndex = 0
    this.currentScene = null
    this.animationId = null
    this.sceneInfo = null
    
    this.initScene()
    this.createUI()
  }

  private initScene(): void {
    // 清理之前的场景
    if (this.currentScene) {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId)
      }
      const canvas = this.currentScene.renderer.domElement
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      this.currentScene.renderer.dispose()
    }

    // 添加到页面
    const appElement = document.querySelector('#app')
    
    if (appElement) {
      // 创建新场景
      this.currentScene = this.scenes[this.currentSceneIndex](appElement as HTMLElement)
      appElement.appendChild(this.currentScene.renderer.domElement)
    }

    // 添加窗口大小变化监听
    window.addEventListener('resize', () => {
      this.currentScene?.handleResize()
    })
    
    // 开始动画
    this.startAnimation()
    
    // 更新UI
    this.updateUI()
  }

  private startAnimation(): void {
    const animate = (): void => {
      this.animationId = requestAnimationFrame(animate)
      this.currentScene!.animate()
    }
    animate()
  }

  public nextScene(): void {
    this.currentSceneIndex = (this.currentSceneIndex + 1) % this.scenes.length
    this.initScene()
  }

  public prevScene(): void {
    this.currentSceneIndex = (this.currentSceneIndex - 1 + this.scenes.length) % this.scenes.length
    this.initScene()
  }

  private createUI(): void {
    // 创建控制面板
    const controlPanel = document.createElement('div')
    controlPanel.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      z-index: 1000;
      min-width: 250px;
    `

    // 标题
    const title = document.createElement('h2')
    title.textContent = 'Three.js 场景演示'
    title.style.cssText = `
      margin: 0 0 15px 0;
      font-size: 18px;
      color: #4ecdc4;
    `
    controlPanel.appendChild(title)

    // 场景信息
    this.sceneInfo = document.createElement('div')
    this.sceneInfo.style.cssText = `
      margin-bottom: 15px;
      line-height: 1.4;
    `
    controlPanel.appendChild(this.sceneInfo)

    // 按钮容器
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    `

    // 上一个场景按钮
    const prevButton = document.createElement('button')
    prevButton.textContent = '← 上一个'
    prevButton.style.cssText = `
      padding: 8px 16px;
      background: #45b7d1;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    `
    prevButton.addEventListener('click', () => this.prevScene())
    prevButton.addEventListener('mouseenter', () => {
      prevButton.style.background = '#3498db'
    })
    prevButton.addEventListener('mouseleave', () => {
      prevButton.style.background = '#45b7d1'
    })
    buttonContainer.appendChild(prevButton)

    // 下一个场景按钮
    const nextButton = document.createElement('button')
    nextButton.textContent = '下一个 →'
    nextButton.style.cssText = `
      padding: 8px 16px;
      background: #45b7d1;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    `
    nextButton.addEventListener('click', () => this.nextScene())
    nextButton.addEventListener('mouseenter', () => {
      nextButton.style.background = '#3498db'
    })
    nextButton.addEventListener('mouseleave', () => {
      nextButton.style.background = '#45b7d1'
    })
    buttonContainer.appendChild(nextButton)

    controlPanel.appendChild(buttonContainer)

    // 场景列表
    const sceneList = document.createElement('div')
    sceneList.innerHTML = `
      <div style="font-size: 12px; color: #888; margin-bottom: 5px;">可用场景：</div>
      <div style="font-size: 12px; line-height: 1.3;">
        1. 角色主导模式<br>
        2. 相机主导模式<br>
        3. 基础场景<br>
        4. 光照效果<br>
        5. 粒子系统
      </div>
    `
    controlPanel.appendChild(sceneList)

    // 添加键盘提示
    const keyboardHint = document.createElement('div')
    keyboardHint.innerHTML = `
      <div style="font-size: 12px; color: #888; margin-top: 15px; padding-top: 10px; border-top: 1px solid #333;">
        键盘快捷键：<br>
        ← → 切换场景
      </div>
    `
    controlPanel.appendChild(keyboardHint)

    document.body.appendChild(controlPanel)

    // 添加键盘事件监听
    document.addEventListener('keydown', (event) => {
      switch(event.key) {
        case 'ArrowLeft':
          this.prevScene()
          break
        case 'ArrowRight':
          this.nextScene()
          break
      }
    })
  }

  private updateUI(): void {
    if (this.sceneInfo && this.currentScene) {
      this.sceneInfo.innerHTML = `
        <div style="font-weight: bold; color: #f9ca24; margin-bottom: 5px;">
          ${this.currentScene.name} (${this.currentSceneIndex + 1}/${this.scenes.length})
        </div>
        <div style="font-size: 14px; color: #ddd;">
          ${this.currentScene.description}
        </div>
      `
    }
  }
}