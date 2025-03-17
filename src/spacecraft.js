import * as THREE from 'three';

// Function to create and return the spacecraft with all its attributes
export function createSpacecraft(scene) {
    // X-wing spacecraft
    const spacecraft = new THREE.Group();

    // Materials
    const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.0 });
    const paintMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e5e5, metalness: 0.2, roughness: 0.7 });
    const redPaintMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333, metalness: 0.2, roughness: 0.7 });
    const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0, transmission: 1, transparent: true, opacity: 0.3, envMapIntensity: 1.0 });
    const engineGlowMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2.5, transparent: true, opacity: 0.9 });
    const boostFlameMaterial = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, intensity: { value: 0.0 } },
        vertexShader: `
            varying vec3 vPosition;
            varying vec3 vNormal;
            void main() {
                vPosition = position;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float intensity;
            varying vec3 vPosition;
            varying vec3 vNormal;
            float rand(vec2 co) {
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }
            void main() {
                float t = time * 3.0;
                float pulse = (sin(t) * 0.5 + 0.5) * 0.3;
                float glow = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.5);
                vec3 coreColor = vec3(1.0, 0.0, 1.0);
                vec3 outerColor = vec3(0.8, 0.2, 1.0);
                vec3 color = mix(outerColor, coreColor, glow + pulse);
                glow *= (1.0 + intensity * 1.5);
                color *= (1.0 + intensity * 0.5);
                color *= 1.5 + intensity * 0.5;
                gl_FragColor = vec4(color, (glow + pulse) * (0.7 + intensity * 0.3));
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending
    });
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

    // Fuselage
    const fuselageGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3.5, 12);
    const fuselage = new THREE.Mesh(fuselageGeometry, paintMaterial);
    fuselage.rotation.z = Math.PI / 2;
    spacecraft.add(fuselage);

    const fuselageDetailGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
    const detailPositions = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5];
    detailPositions.forEach(pos => {
        const detail = new THREE.Mesh(fuselageDetailGeometry, metalMaterial);
        detail.rotation.z = Math.PI / 2;
        detail.position.z = pos;
        fuselage.add(detail);
    });

    // Nose
    const noseGeometry = new THREE.CylinderGeometry(0.3, 0.05, 1.2, 12);
    const nose = new THREE.Mesh(noseGeometry, paintMaterial);
    nose.position.z = 2.35;
    nose.rotation.x = Math.PI / 2;
    spacecraft.add(nose);

    const noseRingGeometry = new THREE.TorusGeometry(0.31, 0.02, 8, 24);
    const noseRing1 = new THREE.Mesh(noseRingGeometry, metalMaterial);
    noseRing1.position.z = 2.0;
    spacecraft.add(noseRing1);

    const noseRing2 = new THREE.Mesh(noseRingGeometry, metalMaterial);
    noseRing2.position.z = 2.3;
    spacecraft.add(noseRing2);

    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.25, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
    const cockpitOuter = new THREE.Mesh(cockpitGeometry, metalMaterial);
    cockpitOuter.position.set(0, 0.25, 0);
    spacecraft.add(cockpitOuter);

    const cockpitGlassGeometry = new THREE.SphereGeometry(0.24, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.5);
    const cockpitGlass = new THREE.Mesh(cockpitGlassGeometry, glassMaterial);
    cockpitGlass.position.set(0, 0.25, 0);
    spacecraft.add(cockpitGlass);

    // Engines
    const engineGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.8, 12);
    const enginePositions = [
        { x: 0.4, y: 0.3, z: -1 },
        { x: -0.4, y: 0.3, z: -1 },
        { x: 0.4, y: -0.3, z: -1 },
        { x: -0.4, y: -0.3, z: -1 }
    ];
    enginePositions.forEach(pos => {
        const engine = new THREE.Mesh(engineGeometry, metalMaterial);
        engine.position.set(pos.x, pos.y, pos.z);
        engine.rotation.x = Math.PI / 2;
        spacecraft.add(engine);

        const intakeGeometry = new THREE.TorusGeometry(0.15, 0.02, 8, 24);
        const intake = new THREE.Mesh(intakeGeometry, darkMetalMaterial);
        intake.position.set(pos.x, pos.y, pos.z - 0.4);
        spacecraft.add(intake);

        const innerGlowGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12);
        const innerGlow = new THREE.Mesh(innerGlowGeometry, engineGlowMaterial);
        innerGlow.position.set(pos.x, pos.y, pos.z + 0.35);
        innerGlow.rotation.x = Math.PI / 2;
        spacecraft.add(innerGlow);

        const glowSphereGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const glowSphere = new THREE.Mesh(glowSphereGeometry, boostFlameMaterial);
        glowSphere.position.set(pos.x, pos.y, pos.z - 0.4);
        glowSphere.visible = true;
        spacecraft.add(glowSphere);
    });

    let engineTime = 0;
    function updateEngineEffects(isBoost) {
        engineTime += 0.016;
        spacecraft.traverse((child) => {
            if (child.material === boostFlameMaterial) {
                child.material.uniforms.time.value = engineTime;
                child.material.uniforms.intensity.value = isBoost ? 1.0 : 0.0;
                child.scale.setScalar(isBoost ? 1.5 : 1.0);
            }
        });
    }

    // Wing creation
    function createWing(x, y, z, rotationZ) {
        const wingGroup = new THREE.Group();
        wingGroup.position.set(x, y, z);
        wingGroup.rotation.z = rotationZ;

        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, -0.1);
        wingShape.lineTo(2.5, -0.15);
        wingShape.lineTo(2.5, 0.15);
        wingShape.lineTo(0, 0.1);
        wingShape.lineTo(0, -0.1);

        const wingExtrudeSettings = { steps: 1, depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 };
        const wingGeometry = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
        const wing = new THREE.Mesh(wingGeometry, paintMaterial);
        wingGroup.add(wing);

        const stripeGeometry = new THREE.BoxGeometry(0.5, 0.06, 0.08);
        const stripe1 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
        stripe1.position.set(0.6, 0, 0);
        wingGroup.add(stripe1);

        const stripe2 = new THREE.Mesh(stripeGeometry, redPaintMaterial);
        stripe2.position.set(1.2, 0, 0);
        wingGroup.add(stripe2);

        const wingTipGeometry = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 8);
        const wingTip = new THREE.Mesh(wingTipGeometry, metalMaterial);
        wingTip.position.set(2.5, 0, 0);
        wingTip.rotation.z = Math.PI / 2;
        wingGroup.add(wingTip);

        const cannonGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.2, 8);
        const cannonPositions = [{ x: 3.0, y: 0, z: 0.2 }, { x: 3.0, y: 0, z: -0.2 }];
        cannonPositions.forEach(pos => {
            const cannon = new THREE.Mesh(cannonGeometry, darkMetalMaterial);
            cannon.position.set(pos.x, pos.y, pos.z);
            cannon.rotation.x = Math.PI / 2;
            wingGroup.add(cannon);

            const ringGeometry = new THREE.TorusGeometry(0.04, 0.01, 8, 16);
            const positions = [-0.4, -0.2, 0, 0.2, 0.4];
            positions.forEach(ringPos => {
                const ring = new THREE.Mesh(ringGeometry, metalMaterial);
                ring.position.set(pos.x, pos.y, pos.z + ringPos);
                ring.rotation.x = Math.PI / 2;
                wingGroup.add(ring);
            });
        });

        return wingGroup;
    }

    const topRightWing = createWing(0, 0.3, -0.5, -Math.PI / 8);
    topRightWing.name = "topRightWing";
    const bottomRightWing = createWing(0, -0.3, -0.5, Math.PI / 8);
    bottomRightWing.name = "bottomRightWing";
    const topLeftWing = createWing(0, 0.3, -0.5, Math.PI + Math.PI / 8);
    topLeftWing.name = "topLeftWing";
    const bottomLeftWing = createWing(0, -0.3, -0.5, Math.PI - Math.PI / 8);
    bottomLeftWing.name = "bottomLeftWing";
    spacecraft.add(topRightWing);
    spacecraft.add(bottomRightWing);
    spacecraft.add(topLeftWing);
    spacecraft.add(bottomLeftWing);

    // Struts
    function createEnhancedStrut(x, y, z, rotationZ) {
        const strutGroup = new THREE.Group();
        const strutGeometry = new THREE.BoxGeometry(0.6, 0.08, 0.08);
        const strut = new THREE.Mesh(strutGeometry, metalMaterial);
        strut.position.set(x, y, z - 0.5);
        strut.rotation.z = rotationZ;
        strutGroup.add(strut);

        const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const detail1 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
        detail1.position.set(x - 0.25, y, z - 0.5);
        detail1.rotation.z = rotationZ;
        strutGroup.add(detail1);

        const detail2 = new THREE.Mesh(detailGeometry, darkMetalMaterial);
        detail2.position.set(x + 0.25, y, z - 0.5);
        detail2.rotation.z = rotationZ;
        strutGroup.add(detail2);

        return strutGroup;
    }

    spacecraft.add(createEnhancedStrut(0, 0.15, 0, 0));
    spacecraft.add(createEnhancedStrut(0, -0.15, 0, 0));

    // Surface details
    function addSurfaceDetails() {
        const panelLineGeometry = new THREE.BoxGeometry(0.01, 0.01, 0.5);
        const panelLineMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.8 });
        for (let i = 0; i < 8; i++) {
            const panelLine = new THREE.Mesh(panelLineGeometry, panelLineMaterial);
            panelLine.position.set(0.2, 0.1, -1 + i * 0.5);
            spacecraft.add(panelLine);
        }

        const detailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const detailPositions = [
            { x: 0.2, y: 0.2, z: -1 },
            { x: -0.2, y: 0.2, z: -1 },
            { x: 0.2, y: -0.2, z: -1 },
            { x: -0.2, y: -0.2, z: -1 }
        ];
        detailPositions.forEach(pos => {
            const detail = new THREE.Mesh(detailGeometry, darkMetalMaterial);
            detail.position.set(pos.x, pos.y, pos.z);
            spacecraft.add(detail);
        });
    }

    addSurfaceDetails();

    const xwingLight = new THREE.PointLight(0xffffff, 0.5);
    xwingLight.position.set(0, 2, 0);
    spacecraft.add(xwingLight);

    spacecraft.position.set(40000, 40000, 40000);
    const centerPoint = new THREE.Vector3(0, 0, 10000);
    spacecraft.lookAt(centerPoint);
    scene.add(spacecraft);

    // Laser setup
    const laserLength = 100;
    const laserThickness = 0.15;
    const laserMaterial = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 });
    const laserGeometry = new THREE.BoxGeometry(laserThickness, laserThickness, laserLength);

    let activeLasers = [];
    let isFiring = false;
    let firingInterval = null;

    const wingtipObjects = [
        new THREE.Object3D(),
        new THREE.Object3D(),
        new THREE.Object3D(),
        new THREE.Object3D()
    ];
    const wingtipOffsets = [
        new THREE.Vector3(3.0, 0, 0.2),
        new THREE.Vector3(3.0, 0, -0.2),
        new THREE.Vector3(-3.0, 0, 0.2),
        new THREE.Vector3(-3.0, 0, -0.2)
    ];
    wingtipObjects[0].position.copy(wingtipOffsets[0]);
    topRightWing.add(wingtipObjects[0]);
    wingtipObjects[1].position.copy(wingtipOffsets[1]);
    bottomRightWing.add(wingtipObjects[1]);
    wingtipObjects[2].position.copy(wingtipOffsets[2]);
    topLeftWing.add(wingtipObjects[2]);
    wingtipObjects[3].position.copy(wingtipOffsets[3]);
    bottomLeftWing.add(wingtipObjects[3]);

    function createLaser(startPosition, direction) {
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        laser.position.copy(startPosition);
        laser.lookAt(startPosition.clone().add(direction));
        laser.position.add(direction.clone().multiplyScalar(laserLength / 2));
        laser.userData = { direction: direction.clone(), speed: 2, lifetime: 1000, startTime: performance.now() };
        return laser;
    }

    function fireLasers() {
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(spacecraft.quaternion);
        wingtipObjects.forEach(obj => {
            const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
            obj.add(marker);
        });
    }

    function startFiring() {
        if (isFiring) return;
        isFiring = true;
        firingInterval = setInterval(fireLasers, 100);
    }

    function stopFiring() {
        isFiring = false;
        clearInterval(firingInterval);
    }

    function updateLasers() {
        const currentTime = performance.now();
        for (let i = activeLasers.length - 1; i >= 0; i--) {
            const laser = activeLasers[i];
            laser.position.add(laser.userData.direction.clone().multiplyScalar(laser.userData.speed));
            if (currentTime - laser.userData.startTime > laser.userData.lifetime) {
                scene.remove(laser);
                activeLasers.splice(i, 1);
            }
        }
    }

    // Return an object containing the spacecraft and all necessary methods and attributes
    return {
        spacecraft,
        engineGlowMaterial,
        boostFlameMaterial,
        lightMaterial,
        topRightWing,
        bottomRightWing,
        topLeftWing,
        bottomLeftWing,
        updateEngineEffects,
        createWing,
        fireLasers,
        startFiring,
        stopFiring,
        updateLasers,
        wingtipObjects // Include wingtipObjects for laser functionality
    };
}