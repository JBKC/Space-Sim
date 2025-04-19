// cockpitVR.js - Creates a cockpit model for VR environment

import * as THREE from 'three';
import { universalScaleFactor } from '../appConfig/loaders.js';

// Create and return a cockpit model that surrounds the camera
export function createCockpit() {
    // Create a group to hold all cockpit parts
    const cockpitGroup = new THREE.Group();
    
    // Add transparent dashboard panel
    const dashboardGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.1);
    const dashboardMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.7
    });
    const dashboard = new THREE.Mesh(dashboardGeometry, dashboardMaterial);
    dashboard.position.set(0, -0.3, -0.7);
    cockpitGroup.add(dashboard);
    
    // Add cockpit frame/window structure
    const frameColor = 0x555555;
    
    // Top frame
    const topFrameGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.1);
    const frameMaterial = new THREE.MeshBasicMaterial({ color: frameColor });
    const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
    topFrame.position.set(0, 0.7, -1.0);
    cockpitGroup.add(topFrame);
    
    // Left frame
    const leftFrameGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.1);
    const leftFrame = new THREE.Mesh(leftFrameGeometry, frameMaterial);
    leftFrame.position.set(-0.9, 0, -1.0);
    cockpitGroup.add(leftFrame);
    
    // Right frame
    const rightFrameGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.1);
    const rightFrame = new THREE.Mesh(rightFrameGeometry, frameMaterial);
    rightFrame.position.set(0.9, 0, -1.0);
    cockpitGroup.add(rightFrame);
    
    // Bottom frame
    const bottomFrameGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.1);
    const bottomFrame = new THREE.Mesh(bottomFrameGeometry, frameMaterial);
    bottomFrame.position.set(0, -0.7, -1.0);
    cockpitGroup.add(bottomFrame);
    
    // Add side panels
    const sidePanelGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.05);
    const sidePanelMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.5
    });
    
    // Left side panel
    const leftPanel = new THREE.Mesh(sidePanelGeometry, sidePanelMaterial);
    leftPanel.position.set(-1.0, 0, -0.5);
    leftPanel.rotation.y = Math.PI / 4; // 45 degrees
    cockpitGroup.add(leftPanel);
    
    // Right side panel
    const rightPanel = new THREE.Mesh(sidePanelGeometry, sidePanelMaterial);
    rightPanel.position.set(1.0, 0, -0.5);
    rightPanel.rotation.y = -Math.PI / 4; // -45 degrees
    cockpitGroup.add(rightPanel);
    
    // Add control sticks
    const stickGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2);
    const stickMaterial = new THREE.MeshBasicMaterial({ color: 0x222222 });
    
    // Left control stick
    const leftStick = new THREE.Mesh(stickGeometry, stickMaterial);
    leftStick.position.set(-0.4, -0.4, -0.6);
    leftStick.rotation.x = Math.PI / 6; // Tilt slightly
    cockpitGroup.add(leftStick);
    
    // Right control stick
    const rightStick = new THREE.Mesh(stickGeometry, stickMaterial);
    rightStick.position.set(0.4, -0.4, -0.6);
    rightStick.rotation.x = Math.PI / 6; // Tilt slightly
    cockpitGroup.add(rightStick);
    
    // Add a simple HUD display
    const hudGeometry = new THREE.PlaneGeometry(0.5, 0.2);
    const hudMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.6
    });
    const hud = new THREE.Mesh(hudGeometry, hudMaterial);
    hud.position.set(0, 0.2, -0.9);
    cockpitGroup.add(hud);
    
    // Scale the entire cockpit to appropriate size
    cockpitGroup.scale.set(
        universalScaleFactor * 0.5,
        universalScaleFactor * 0.5,
        universalScaleFactor * 0.5
    );
    
    console.log("Created VR cockpit model");
    return cockpitGroup;
} 