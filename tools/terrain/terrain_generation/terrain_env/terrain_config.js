// Simplified configuration specifically for the terrain viewer
export default {
  // Define animation constants
  animation: {
    wingTransitionFrames: 30,
  },
  
  // Camera settings
  camera: {
    default: {
      base: { x: 0, y: 2, z: 30 },
      boost: { x: 0, y: 2, z: 200 },
      slow: { x: 0, y: 2, z: 12 },
    },
    cockpit: {
      base: { x: 0, y: 0, z: 44.9 },
      boost: { x: 0, y: 0, z: 224.7 },
      slow: { x: 0, y: 0, z: 22.5 },
    },
    cinematic: {
      maxPitchOffset: 0.1,
      maxYawOffset: 0.15,
      lagFactor: 0.1,
      transitionSpeed: 0.15,
      defaultFOV: 75,
    }
  },
  
  // Movement settings
  movement: {
    baseSpeed: 5,
    boostSpeed: 25,
    slowSpeed: 2.5,
    turnSpeed: 0.02,
    sensitivity: {
      pitch: 0.6,
      roll: 1.0,
      yaw: 0.5
    }
  },
  
  // Colors
  colors: {
    reticle: 0xFF5349,
    engineGlow: 0x0088ff,
    lights: 0xffffff
  }
}; 