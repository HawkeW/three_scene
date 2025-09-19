import * as THREE from 'three'

export interface SceneConfig {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  animate: () => void
  handleResize: () => void
  name: string
  description: string
}

export type SceneCreator = (container: HTMLElement) => SceneConfig