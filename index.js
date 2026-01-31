import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import { initUI, UIState } from './ui.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { securityShader } from './data/shaders/shader atlas.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

class App {

    constructor() {
        
        this.fps = 0;
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();

        this.scene = null;
        this.renderer = null;
        this.camera = null;
		this.OriginalCameraPosition = new THREE.Vector3(12.5, 3.5, 8);
		this.OriginalCameraTarget = new THREE.Vector3(2.5, 3, 3);
        this.controls = null;        
		
		// projects and frames
		this.projects = [];
		this.frames = [];

		// raycaster
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.intersectedFrame = null;
		this.mainFrame = null;
		this.currentFrameIndex = 0;

		// jukebox interaction
		this.selectedJukebox = false;

        // instantiate loaders
		this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
		this.audioLoader = new THREE.AudioLoader();

		// animation mixers
		this.mixerMusic = null;
		this.mixerAvatar = null;

		// actions
		this.idleAction = 'holding';
		this.currentAction = this.idleAction;
		this.baseActions = {
			breathe: {weight: 0},
			look: {weight: 0},
			sad: {weight: 0},
			wave: {weight: 0},
			holding: {weight: 0}
		};
		this.baseActions[this.idleAction].weight = 1;

		// positional audio for record player
		this.jukebox = null;
		this.vinyl = null;
		this.sound = null;
		this.listener = new THREE.AudioListener();

		this.labelRenderer = new CSS3DRenderer();

		// contact info
		this.contactInfo = {
			github: 'https://github.com/carolinadcf',
			linkedin: 'https://www.linkedin.com/in/carolina-dcf/',
			mail: 'mailto:carolina.cdc@outlook.com'
		};
		this.contactSelected = null;

		// postprocessing
		this.composer = null;
		this.renderPass = null;
		this.outlinePass = null;
		this.selectedObjects = [ ];

		// light
		this.lights = [];
		this.day = true;
		this.lightTransition = null; // transition state (used for smooth day/night lerp)
		this.lightConfig = {
			day: {
				ambientIntensity: 1.0,
				ambientColor: new THREE.Color("#ffffff"),
				dirIntensity: 1.0,
				dirColor: new THREE.Color("#ffffff"),
				bgColor: new THREE.Color("#657aa2"),
				exposure: 1.0,
				frameIntensity: 0.0,
				avatarLightIntensity: 0.0
			},
			night:
			{
				ambientIntensity: 0.75,
				ambientColor: new THREE.Color("#2a3b4f"),
				dirIntensity: 0.45,
				dirColor: new THREE.Color("#99bbff"),
				bgColor: new THREE.Color("#071226"),
				exposure: 0.8,
				frameIntensity: 1.5,
				avatarLightIntensity: 2.0
			}
		};
	}

	init( ) {
		// scene
		this.scene = new THREE.Scene();
		this.scene.background = this.day ? this.lightConfig.day.bgColor.clone() : this.lightConfig.night.bgColor.clone();

		// renderer
		this.renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, logarithmicDepthBuffer: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.VSMShadowMap;
		
        this.renderer.toneMapping = THREE.CineonToneMapping;
		this.renderer.toneMappingExposure = this.day ? this.lightConfig.day.exposure : this.lightConfig.night.exposure;
		document.getElementById('webgl').appendChild(this.renderer.domElement);

		// label renderer
		this.labelRenderer.setSize( window.innerWidth, window.innerHeight );
		this.labelRenderer.domElement.style.pointerEvents = 'none';
		document.body.appendChild(this.labelRenderer.domElement);
		// document.getElementById('css').appendChild(this.labelRenderer.domElement);

		// camera
		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
		this.camera.position.copy(this.OriginalCameraPosition);

		// controls
		this.controls = new OrbitControls( this.camera, this.renderer.domElement );
		this.controls.target.copy(this.OriginalCameraTarget);
		this.controls.maxDistance = 15;
		this.controls.maxPolarAngle = Math.PI / 2;
		this.controls.update();

		this.eventListeners( );
		
		// lights
		this.addLights();

        // museum
		this.gltfLoader.load( './data/vr_gallery/scene.gltf', ( gltf ) => {
			this.museum = gltf.scene;
			this.museum.name = "museum";
			this.museum.scale.set(2,2,2);
			this.museum.castShadow = true;
			this.museum.receiveShadow = true;

			this.museum.traverse((child) => {
				if (child.isMesh) {
					const prevMap = child.material.map;
					child.material = new THREE.MeshStandardMaterial({
						map: prevMap,
					});
					child.receiveShadow = true;
					child.castShadow = true;
				}
			});
			
			this.scene.add( this.museum );

			$( '#preloader-stub' ).addClass('stub-animated');			
			$( '#preloader' ).addClass('preloader-animated');		
			$( '#ocrloader' ).addClass('ocrloader-close');	
			this.animate();
            }
        );

        // floor
        this.gltfLoader.load( './data/checkered_tile_floor/scene.gltf', ( gltf ) => {
			this.floor = gltf.scene;
			this.floor.name = "floor";
			this.floor.position.y = -0.01;
			this.floor.scale.set(0.1,0.1,0.1);

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});
			
			this.scene.add( this.floor );
            }
        );

        // me
        this.gltfLoader.load( 'https://models.readyplayer.me/66e848b1356adbb310ece566.glb?morphTargets=ARKit,Oculus Visemes', ( gltf ) => {
			this.carol = gltf.scene;
			this.carol.name = "carol";

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});
			
			this.scene.add( this.carol );

			// const skeleton = new THREE.SkeletonHelper(this.carol);
			// this.scene.add(skeleton);
	
			// Create an AnimationMixer for your avatar
			this.mixerAvatar = new THREE.AnimationMixer(this.carol);

			// load idle animation
			this.gltfLoader.load('./data/animations/' + this.idleAction + '.glb', (gltf) => {
				const animation = gltf.animations[0];  // Assuming it's the first animation
				animation.name = this.idleAction; // rename animation
				
				// Create an action for the Mixamo animation and play it
				this.baseActions[this.idleAction].action = this.mixerAvatar.clipAction(animation);
				this.baseActions[this.idleAction].action.play();
				}, undefined, function(error) {
				console.error('An error occurred while loading the animation:', error);
			});

			// load wave animation
			this.gltfLoader.load('./data/animations/wave.glb', (gltf) => {
				const animation = gltf.animations[0];  // Assuming it's the first animation
				animation.name = "wave"; // rename animation

				// Create an action for the Mixamo animation and play it
				this.baseActions.wave.action = this.mixerAvatar.clipAction(animation);
				this.baseActions.wave.action.clampWhenFinished = true;
				this.baseActions.wave.action.setLoop(THREE.LoopOnce);

				}, undefined, function(error) {
				console.error('An error occurred while loading the animation:', error);
			});

			// when wave ends, go back to idle
			this.mixerAvatar.addEventListener('finished', (e) => {
				if (e.action === this.baseActions.wave.action) {
					this.swapAnimations(this.idleAction);
				}
			});

			// light for avatar
			const avatarLight = new THREE.SpotLight(0xffffff, 2.0, 10, Math.PI / 6, 0.2, 2);
			avatarLight.position.set(0, 3, 2);
			avatarLight.target = this.carol;
			// identify the light
			avatarLight.name = 'avatarLight';
			this.carol.userData.avatarLight = avatarLight;
			this.carol.add(avatarLight);
		});

		// jukebox
        this.gltfLoader.load( './data/record_player/scene.gltf', ( gltf ) => {
			this.jukebox = gltf.scene;
			this.jukebox.name = "jukebox";
			this.jukebox.scale.set(0.5,0.5,0.5);
			this.jukebox.position.y = 1.55;

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});
			
			this.vinyl = this.jukebox.getObjectByName("Cylinder006_0");
			this.vinyl.material.color = new THREE.Color("#e0c2c2");

			const texture = this.textureLoader.load( './data/carol.png' );
			texture.colorSpace = THREE.SRGBColorSpace;
			this.vinyl.material.map = texture;

			this.mixerMusic = new THREE.AnimationMixer( this.jukebox );
			this.mixerMusic.clipAction( gltf.animations[ 0 ] ).play();
			this.mixerMusic.timeScale = 0; // start paused

			this.scene.add( this.jukebox );

			// sound for jukebox
			this.sound = new THREE.PositionalAudio( this.listener );
			this.camera.add( this.listener );
			
			// https://freesound.org/people/CollectionOfMemories/sounds/647591/
			this.audioLoader.load( './data/sounds/lofi.wav', ( buffer ) => {
				this.sound.setBuffer( buffer );
				this.sound.setLoop( true );
				this.sound.setVolume( 0.5 );
			});
			this.jukebox.add( this.sound );

            }
        );

		// contact phone
		this.gltfLoader.load( './data/phone/scene.gltf', ( gltf ) => {
			this.phone = gltf.scene;
			this.phone.name = "phone";
			this.phone.position.set(2.7, 2.5, 9.9);
			this.phone.scale.set(0.4,0.4,0.4);
			this.phone.rotation.y = Math.PI;

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
					const prevMat = child.material;
					child.material = new THREE.MeshStandardMaterial({
						map: prevMat.map,
						color: prevMat.color,
						normalMap: prevMat.normalMap,
						metalnessMap: prevMat.metalnessMap,
						roughnessMap: prevMat.roughnessMap,
					});
				}
			});

			// assign light
			const pointLight = new THREE.PointLight(0xffffff, 1.5, 2);
			pointLight.position.set(0, 0, 1);
			this.phone.add(pointLight);

			this.scene.add( this.phone );
		});

		// contact note pad
		this.gltfLoader.load( './data/notes/scene.gltf', ( gltf ) => {
			this.notePad = gltf.scene;
			this.notePad.name = "contactNote";

			this.notePad.position.set(2, 2.5, 10);
			this.notePad.scale.set(0.07,0.07,0.07);
			this.notePad.rotation.x = -Math.PI/2;
			this.notePad.rotation.y = Math.PI;

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});

			// add css2d to note pad with contact info
			const contactInfoElement = document.createElement('div');
			contactInfoElement.className = 'contact-info';
			contactInfoElement.innerHTML = `
				<h3>Contact Info:</h3>
				<p>GitHub: </p> 
					<span>&emsp; @carolinadcf</span>
				<p>LinkedIn: </p> 
					<span>&emsp; @carolina-dcf</span>
				<p>Email: </p> 
					<span>&emsp; carolina.cdc@outlook.com</span>
				<p>Call me!!</p>
				<img src="./data/book/turn-right-arrow.png" alt="Arrow pointing to the phone"
                        style="max-width: 17%; margin-left: 0%; margin-bottom: 0; transform: rotate(-90deg); filter: brightness(70%);" />
			`;
			
			// make texture from element
			const contactInfoLabel = new CSS3DObject(contactInfoElement);
			contactInfoLabel.element.style.pointerEvents = 'auto';
			contactInfoLabel.element.style.userSelect = 'auto';
			contactInfoLabel.element.style.backfaceVisibility = 'hidden';
			contactInfoLabel.scale.set(0.02, 0.02, 0.02);
			contactInfoLabel.rotation.x = -Math.PI/2;
			contactInfoLabel.position.set(0.8, 0.2, -0.1); // x, z, -y
			
			this.notePad.add(contactInfoLabel);

			this.scene.add( this.notePad );
		});

		// load projects data
		fetch('./data/cv.json')
		.then(response => response.json())
		.then(data => {
			this.projects = data;
			console.log('Projects data loaded:', this.projects);
			
			// populate with projects
			for (let i = 0; i < this.projects.length; i++) {
				const project = this.projects[i];
				this.frames[i] = new THREE.Group();
				this.frames[i].name = project.title; // set name of frame to project title
				// place in different walls
				// left wall
				if (i < 3) {
					this.frames[i].position.set(-9.9, 3, 6 - i*6);
					this.frames[i].rotation.y = Math.PI / 2;
				}
				// front wall
				else if (i < 6) {
					this.frames[i].position.set(-2 + (i-3)*4, 3, -9.9);
				}

				// create texture with project image					
				this.textureLoader.load( project.image, (texture) => {
					texture.colorSpace = THREE.SRGBColorSpace;
					
					// CANVAS
					// plane with image of its size
					const frameGeometry = new THREE.PlaneGeometry();
					// adjust plane size based on image aspect ratio
					const imageAspect = texture.image.width / texture.image.height;
					const frameHeight = 2; // desired height
					const frameWidth = frameHeight * imageAspect;
					frameGeometry.scale(frameWidth, frameHeight, 1);
					
					const frameMaterial = new THREE.MeshStandardMaterial({ map: texture, toneMapped: false});
					const frame = new THREE.Mesh(frameGeometry, frameMaterial);
					frame.position.z = 0.01; // slightly in front of back plane
					frame.name = "frameImage";
					this.frames[i].add(frame);
					
					// back plane (frame)
					const backGeometry = new THREE.PlaneGeometry();
					backGeometry.scale(frameWidth + 0.1, frameHeight + 0.1, 1);
					const backMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
					const backPlane = new THREE.Mesh(backGeometry, backMaterial);
					backPlane.position.z = -0.01; // slightly behind the image
					backPlane.name = "frameBack";
					this.frames[i].add(backPlane);

					// bottom right of the frame
					let x = frameWidth/2 + 0.6;
					let y = -frameHeight/2 + 0.25;
					
					// create a WebGL plane textured from a 2D canvas with the card details
					// so the card is part of the 3D scene (occludable and pickable).
					const cardCanvas = this.createProjectCardCanvas(project);
					const cardTexture = new THREE.CanvasTexture(cardCanvas);
					cardTexture.needsUpdate = true;

					// choose a width in world units and compute height from canvas aspect
					const cardPlaneWidth = 0.75;
					const cardPlaneHeight = cardPlaneWidth * (cardCanvas.height / cardCanvas.width);
					const cardGeometry = new THREE.PlaneGeometry(cardPlaneWidth, cardPlaneHeight);
					const cardMaterial = new THREE.MeshBasicMaterial({ map: cardTexture, transparent: true, toneMapped: false });
					const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
					cardMesh.position.set( x, y, 0.01 ); // slightly in front of frame image
					// attach project data for click handling
					cardMesh.userData.project = project;
					cardMesh.name = "cardMesh";
					this.frames[i].add(cardMesh);
					
					// add a small light to highlight the frame at night (start off)
					const frameLight = new THREE.SpotLight(0xfff2c8, 0.0, 6, Math.PI / 3, 0.3, 2);
					frameLight.position.set(0, 1.6, 1);
					frameLight.target = backPlane;
					frameLight.name = 'frameLight';
					this.frames[i].add(frameLight);
					this.frames[i].userData.frameLight = frameLight;
					
					// wall lamps model
					this.gltfLoader.load( './data/wall_lamp/scene.gltf', ( gltf ) => {
						const wallLamp = gltf.scene;
						wallLamp.scale.set(0.005,0.005,0.005);
						wallLamp.position.set(0, 1.6, 0.5);
						wallLamp.name = "wallLamp";
						
						this.frames[i].add( wallLamp );
					});
				});

				// add to scene
				this.scene.add(this.frames[i]);
			}
		})
		.catch(error => {
			console.error('Error loading projects data:', error);
		});

		// security camera
		this.gltfLoader.load( './data/security_camera/scene.gltf', ( gltf ) => {
			this.securityCamera = gltf.scene;
			this.securityCamera.name = "securityCamera";
			this.securityCamera.position.set(9.5, 5.5, -9.5);
			this.securityCamera.scale.set(0.3,0.3,0.3);
			this.securityCamera.rotation.y = -Math.PI / 4;
			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});
			this.scene.add(this.securityCamera);
		});

		// postprocessing
		this.composer = new EffectComposer(this.renderer);
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.composer.addPass(this.renderPass);

		this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
		this.outlinePass.edgeStrength = 3.0;
		this.outlinePass.edgeGlow = 0.3;
		this.outlinePass.pulsePeriod = 2;
		this.outlinePass.hiddenEdgeColor.set(0xffffff);

		this.composer.addPass(this.outlinePass);

		this.effectFXAA = new ShaderPass(FXAAShader);
		this.effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
		this.composer.addPass(this.effectFXAA);
		
		// black and white shader
		this.securityShader = new ShaderPass(securityShader);
		this.securityShader.enabled = false;
		this.composer.addPass(this.securityShader);
		// end postprocessing

		// initialize UI
		initUI();

	} // end init

	eventListeners( ) {
		// event listeners
		window.addEventListener( 'resize', this.onWindowResize.bind(this) );
		window.addEventListener( 'mousemove', this.onMouseMove.bind(this), false );
		window.addEventListener( 'click', this.onMouseClick.bind(this), false );
		window.addEventListener( 'keydown', this.onKeyDown.bind(this), false );
		
		// remove UI when moving camera
		this.controls.addEventListener( 'change', () => {
			document.getElementById('scene-ui').style.display = 'none';
			document.getElementById('project-modal').style.display = 'none';
		} );

		// camera back to center
		document.getElementById('back-button').addEventListener('click', () => {
			// animate camera movement
			this.cameraCinematicMove(this.OriginalCameraPosition, this.OriginalCameraTarget, 1000);

			document.getElementById('scene-ui').style.display = 'none';
		});
		// previous artwork
		document.getElementById('prev-button').addEventListener('click', () => {
			const prevIndex = (this.currentFrameIndex - 1 + this.frames.length) % this.frames.length;
			const prevFrame = this.frames[prevIndex];
			// simulate click on previous frame
			this.intersectedFrame = prevFrame;
			this.currentFrameIndex = prevIndex;
			this.onMouseClick();
		});
		// next artwork
		document.getElementById('next-button').addEventListener('click', () => {
			const nextIndex = (this.currentFrameIndex + 1) % this.frames.length;
			const nextFrame = this.frames[nextIndex];
			// simulate click on next frame
			this.intersectedFrame = nextFrame;
			this.currentFrameIndex = nextIndex;
			this.onMouseClick();
		});

		// disable raycaster when moving the camera
		this.controls.addEventListener( 'start', () => {
			UIState.interactionEnabled = false;
		} );
		this.controls.addEventListener( 'end', () => {
			UIState.interactionEnabled = true;
		} );
	}

	onWindowResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
		this.composer.setSize( window.innerWidth, window.innerHeight );

		this.labelRenderer.setSize( window.innerWidth, window.innerHeight );

		this.animate();
	}

    animate() {

        requestAnimationFrame( this.animate.bind(this) );
				
		const delta = this.clock.getDelta();
		if (this.mixerMusic) this.mixerMusic.update( delta );
		if (this.mixerAvatar) this.mixerAvatar.update( delta );
		if (this.carol) {
			this.carol.position.x = 2.5;
			this.carol.scale.set(1.65,1.65,1.65);
			// always face camera only on y axis
			this.carol.lookAt(new THREE.Vector3(this.camera.position.x, this.carol.position.y, this.camera.position.z));
		}
		
		this.controls.update();

		// update smooth light transition if active
		if (this.lightTransition && this.lightTransition.active) {
			const now = performance.now();
			const lt = this.lightTransition;
			const t = Math.min((now - lt.start) / lt.duration, 1);

			// lerp numeric values
			const lerp = (a, b, v) => a + (b - a) * v;
			this.ambientLight.intensity = lerp(lt.from.ambientIntensity, lt.to.ambientIntensity, t);
			this.dirLight.intensity = lerp(lt.from.dirIntensity, lt.to.dirIntensity, t);
			if (this.carol && this.carol.userData.avatarLight) {
				this.carol.userData.avatarLight.intensity = lerp(lt.from.avatarLightIntensity, lt.to.avatarLightIntensity, t);
			}
			this.renderer.toneMappingExposure = lerp(lt.from.exposure, lt.to.exposure, t);

			// lerp colors
			this.ambientLight.color.lerpColors(lt.from.ambientColor, lt.to.ambientColor, t);
			this.dirLight.color.lerpColors(lt.from.dirColor, lt.to.dirColor, t);
			if (this.scene.background && lt.from.bgColor && lt.to.bgColor) {
				this.scene.background.lerpColors(lt.from.bgColor, lt.to.bgColor, t);
			}

			// lerp per-frame lights (if present)
			if (lt.to.frameIntensity !== undefined) {
				for (let f of this.frames) {
					if (f.userData && f.userData.frameLight) {
						const fl = f.userData.frameLight;
						const fromVal = (lt.from.frameLightMap && lt.from.frameLightMap[f.uuid] !== undefined) ? lt.from.frameLightMap[f.uuid] : fl.intensity;
						fl.intensity = lerp(fromVal, lt.to.frameIntensity, t);
					}
				}
			}

			if (t >= 1) {
				this.lightTransition.active = false;
				this.day = lt.targetDay ? true : false;
			}
		}
		
		// update security shader time
		this.securityShader.uniforms['time'].value += delta;

		// render
		this.composer.render();
		this.labelRenderer.render( this.scene, this.camera );
	}

	addLights() {
		// initial lights
		this.ambientLight = new THREE.AmbientLight(this.lightConfig.day.ambientColor, this.lightConfig.day.ambientIntensity);
		this.scene.add(this.ambientLight);
		
		this.dirLight = new THREE.DirectionalLight( this.lightConfig.day.dirColor, this.lightConfig.day.dirIntensity );
		this.dirLight.position.set( -2, 10, 0 );
		this.dirLight.castShadow = true;
		this.dirLight.shadow.radius = 4;
		this.dirLight.shadow.bias = - 0.0005;
		
		const dirGroup = new THREE.Group();
		dirGroup.add( this.dirLight );
		this.scene.add( dirGroup );
		
		this.lights.push(this.ambientLight, this.dirLight);
	}

	startLightTransition(targetDay, duration = 1200) {
		// capture from/to states
		let from = {
			ambientIntensity: this.ambientLight.intensity,
			ambientColor: this.ambientLight.color.clone(),
			dirIntensity: this.dirLight.intensity,
			dirColor: this.dirLight.color.clone(),
			bgColor: this.scene.background ? this.scene.background.clone() : new THREE.Color(0x000000),
			exposure: (this.renderer.toneMappingExposure !== undefined) ? this.renderer.toneMappingExposure : 1.0,
			avatarLightIntensity: (this.carol && this.carol.userData.avatarLight) ? this.carol.userData.avatarLight.intensity : 0.0
		};

		// capture current per-frame light intensities (map by frame uuid)
		from.frameLightMap = {};
		for (let f of this.frames) {
			if (f.userData && f.userData.frameLight) {
				from.frameLightMap[f.uuid] = f.userData.frameLight.intensity;
			}
		}

		let to = {
			ambientIntensity: targetDay ? this.lightConfig.day.ambientIntensity : this.lightConfig.night.ambientIntensity,
			ambientColor: targetDay ? this.lightConfig.day.ambientColor.clone() : this.lightConfig.night.ambientColor.clone(),
			dirIntensity: targetDay ? this.lightConfig.day.dirIntensity : this.lightConfig.night.dirIntensity,
			dirColor: targetDay ? this.lightConfig.day.dirColor.clone() : this.lightConfig.night.dirColor.clone(),
			bgColor: targetDay ? this.lightConfig.day.bgColor.clone() : this.lightConfig.night.bgColor.clone(),
			exposure: targetDay ? this.lightConfig.day.exposure : this.lightConfig.night.exposure,
			frameIntensity: targetDay ? this.lightConfig.day.frameIntensity : this.lightConfig.night.frameIntensity,
			avatarLightIntensity: targetDay ? this.lightConfig.day.avatarLightIntensity : this.lightConfig.night.avatarLightIntensity
		};

		this.lightTransition = {
			active: true,
			start: performance.now(),
			duration: duration,
			from: from,
			to: to,
			targetDay: targetDay
		};
	}
	
	toggleSecurityMode() {
		this.securityShader.enabled = !this.securityShader.enabled;
		this.outlinePass.enabled = !this.securityShader.enabled;
		// disable controls when security shader is on
		UIState.interactionEnabled = !this.securityShader.enabled;
		this.controls.enabled = !this.securityShader.enabled;

		// MOVE CAMERA
		if (!this.securityShader.enabled) {
			// move back to original position
			this.cameraCinematicMove(this.OriginalCameraPosition, this.OriginalCameraTarget, 1000);
			return;
		}
		
		// move camera to front of security camera position
		const cameraPosition = new THREE.Vector3();
		this.securityCamera.getWorldPosition(cameraPosition);
		// slight offset forward
		cameraPosition.x -= 0.8;
		cameraPosition.z += 0.75;
		cameraPosition.y -= 0.5;
		const cameraNormal = new THREE.Vector3(0, 0, -1);
		cameraNormal.applyQuaternion(this.securityCamera.quaternion);
		const newCameraPosition = cameraPosition.clone().add(cameraNormal.clone());

		// animate camera movement
		this.cameraCinematicMove(newCameraPosition, cameraPosition, 1000);
	}
	
	onKeyDown(event) {
		if (!event.key) return;
		const key = event.key.toLowerCase();
		
		switch (key) {
			case 'n':
			const targetDay = !this.day;
			this.startLightTransition(targetDay, 1200);
			break;
			case 'g': // security camera shader
			this.toggleSecurityMode();
			break;
			case 'escape': // exit security camera mode
			if (this.securityShader.enabled) {
				this.toggleSecurityMode();
			}
		}
	}

	onMouseMove( event ) {
		// calculate mouse position in normalized device coordinates
		// (-1 to +1) for both components
		this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

		// raycaster
		if (UIState.interactionEnabled)	this.checkIntersections();
	}

	onMouseClick( event ) {
		if (!UIState.interactionEnabled) return;

		// always update raycaster from latest mouse position
		this.raycaster.setFromCamera( this.mouse, this.camera );

		// check for clicks on card occluder meshes (they carry project data)
		const pickIntersects = this.raycaster.intersectObjects( this.frames, true );
		for (let pi = 0; pi < pickIntersects.length; pi++) {
			const obj = pickIntersects[pi].object;
			if (obj.userData && obj.userData.project) {
				// create an HTML card for the modal (keeps existing styling)
				const htmlCard = this.createProjectCard(obj.userData.project);
				this.showCardModal(obj.userData.project, htmlCard);
				return;
			}
		}

		if (this.intersectedFrame) {
			// move camera to the front of the frame
			const framePosition = new THREE.Vector3();
			this.intersectedFrame.getWorldPosition(framePosition);
			const frameNormal = new THREE.Vector3(0, 0, 1);
			frameNormal.applyQuaternion(this.intersectedFrame.quaternion);
			// offset from frame along its normal
			const offset = frameNormal.clone().multiplyScalar(1);
			framePosition.x += offset.z;
			framePosition.y += 0;
			framePosition.z -= offset.x; // small offset up
			
			// calculate zoom out factor according to frame size
			const zoomOutFactor = this.intersectedFrame.scale.length() * 4;
			const newCameraPosition = framePosition.clone().add(frameNormal.clone().multiplyScalar(zoomOutFactor));

			// animate camera movement
			this.cameraCinematicMove(newCameraPosition, framePosition, 1000, () => {
				// show visit link and back button
				document.getElementById('scene-ui').style.display = 'flex';
				// add clickable functional link
				const project = this.projects[this.currentFrameIndex];
				var link = document.getElementById('visit-link-button');
				link.href = project.link;
				link.target = '_blank';
			});
		}
		
		if (this.jukebox) {
			const intersectsJukebox = this.raycaster.intersectObject( this.jukebox, true );
			if (intersectsJukebox.length > 0) {
				this.selectedJukebox = !this.selectedJukebox;
				// toggle sound play/pause on click
				if (this.sound.isPlaying) {
					this.sound.pause();
					this.mixerMusic.timeScale = 0; // pause vinyl
				} else {
					this.sound.play();
					this.mixerMusic.timeScale = 1.0; // resume vinyl
				}

				// move camera to top right corner of jukebox
				const jukeboxPosition = new THREE.Vector3();
				this.jukebox.getWorldPosition(jukeboxPosition);
				jukeboxPosition.y += 0.75;
				jukeboxPosition.z += 0.25;
				const newCameraPosition = jukeboxPosition.clone().add(new THREE.Vector3(2, 1, 2));

				// animate camera movement
				this.cameraCinematicMove(newCameraPosition, jukeboxPosition, 1000, () => {
					// document.getElementById('back-button').style.display = 'inline-block';
				});
			}
		}
		
		if (this.phone) {
			const intersectsPhone = this.raycaster.intersectObject( this.phone, true );
			if (intersectsPhone.length > 0) {
				
				// move camera to front of phone
				const phonePosition = new THREE.Vector3();
				this.phone.getWorldPosition(phonePosition);
				const phoneNormal = new THREE.Vector3(0, 0, 1);
				phoneNormal.applyQuaternion(this.phone.quaternion);

				const newCameraPosition = phonePosition.clone().add(phoneNormal.clone().multiplyScalar(2));

				// animate camera movement
				this.cameraCinematicMove(newCameraPosition, phonePosition, 1000, () => {
					// document.getElementById('back-button').style.display = 'inline-block';
				});
			}
		}

		// contact info
		if (this.contactSelected) {
			const link = this.contactInfo[this.contactSelected];
			this.contactSelected = null;
			window.open(link, '_blank');
		}

		// secutiry camera
		if (this.securityCamera) {
			const intersectsCamera = this.raycaster.intersectObject( this.securityCamera, true );
			if (intersectsCamera.length > 0) {
				this.toggleSecurityMode();
			}
		}
	}

	checkIntersections() {
		this.raycaster.setFromCamera( this.mouse, this.camera );
		this.selectedObjects = [ ];

		// frame interaction
		const intersects = this.raycaster.intersectObjects( this.frames, true );
		
		// reset all frames
		this.frames.forEach( (frame) => {
			frame.getObjectByName("frameBack").material.emissive = new THREE.Color(0x000000);
			frame.getObjectByName("frameBack").material.color = new THREE.Color(0x000000);
		});
		
		// highlight intersected frame
		for ( let i = 0; i < intersects.length; i++ ) {
			if (intersects[i].object.userData && intersects[i].object.userData.project) {
				// border shadow on card occluder
				this.selectedObjects = [ intersects[i].object ];
				continue;
			};
			// highlight border of frame
			this.intersectedFrame = intersects[i].object.parent;
			try {
				this.intersectedFrame.getObjectByName("frameBack").material.emissive = new THREE.Color(0xffffff);
				this.intersectedFrame.getObjectByName("frameBack").material.color = new THREE.Color(0xffffff);
				this.currentFrameIndex = this.frames.indexOf(this.intersectedFrame);
			} catch (e) {
				// in case intersected object is not part of a frame (light, wall lamp, etc)
				this.intersectedFrame = null;
			}
		}
		
		// change cursor style
		if ( intersects.length > 0 && this.intersectedFrame ) { $('html, body').css('cursor', 'pointer'); }
		else {
			$('html, body').css('cursor', 'default');
			this.intersectedFrame = null;
		}
		
		// my avatar interaction
		if (this.carol) {
			const intersectsAvatar = this.raycaster.intersectObject( this.carol, true );
			if (intersectsAvatar.length > 0) {
				// play wave animation
				if (this.currentAction !== 'wave') {
					this.swapAnimations('wave');
				}
				// outline avatar
				this.selectedObjects = [ this.carol ];
			}
		}

		// record player interaction
		if (this.jukebox) {
			const intersectsJukebox = this.raycaster.intersectObject( this.jukebox, true );
			if (intersectsJukebox.length > 0) {
				// start vinyl rotation animation
				if (this.mixerMusic) {
					this.mixerMusic.timeScale = 1.0;
					if (!this.sound.isPlaying) this.sound.play(); // if sound not playing, play
				}
				// outline jukebox
				this.selectedObjects = [ this.jukebox ];
			}
			else if (!this.selectedJukebox) {
				// stop vinyl rotation animation
				if (this.mixerMusic) {
					this.mixerMusic.timeScale = 0;
					if (this.sound.isPlaying) this.sound.pause(); // if sound playing, pause
				}
			}
		}

		// phone interaction
		if (this.phone) {
			const intersectsPhone = this.raycaster.intersectObject( this.phone, true );
			if (intersectsPhone.length > 0) {
				// outline phone
				this.selectedObjects = [ this.phone ];
				this.contactSelected = null;

				// traverse up to find if rrss group
				for ( let i = 0; i < intersectsPhone.length; i++ ) {
					let obj = intersectsPhone[0].object;
					while (obj.parent && obj.parent !== this.phone) {
						obj = obj.parent;
						if (obj.name === "github") {
							$('html, body').css('cursor', 'pointer');
							this.selectedObjects = [ obj ];
							this.contactSelected = 'github';
						} else if (obj.name === "linkedin") {
							$('html, body').css('cursor', 'pointer');
							this.selectedObjects = [ obj ];
							this.contactSelected = 'linkedin';
						} else if (obj.name === "mail") {
							$('html, body').css('cursor', 'pointer');
							this.selectedObjects = [ obj ];
							this.contactSelected = 'mail';
						}
					}

				}
			}
		}

		// security camera interaction
		if (this.securityCamera) {
			const intersectsCamera = this.raycaster.intersectObject( this.securityCamera, true );
			if (intersectsCamera.length > 0) {
				// outline security camera
				this.selectedObjects = [ this.securityCamera ];
			}
		}

		// update outline pass
		this.outlinePass.selectedObjects = this.selectedObjects;
	}

	createProjectCard(project) {
		// create HTML elements for project card
		const card = document.createElement('div');
		card.className = 'project-card';

		card.innerHTML = `<h1 class="project-title">${project.title}</h1>
			<div class="project-subinfo">
				<h3 class="project-organization">${project.organization}</h3>
				<p class="project-dates">${project.startDate || ''}${project.endDate ? ' - ' + project.endDate : ''}</p>
			</div>
			<hr>
			<p class="project-description">${project.description}</p>
			<a href="${project.link}" class="project-link" target="_blank">${project.linkText || 'Visit Project'}</a>
			<div class="project-tags">[${(project.tags || []).join(', ')}]</div>
    	`;

		// show 2d card on click
		card.onclick = (e) => {
			e.stopPropagation(); // prevent event bubbling
			this.showCardModal(project, card);
		};
		
		return card;
	}

	createProjectCardCanvas(project) {
		const width = 800;
		const height = 500;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');

		// background
		ctx.fillStyle = '#e3d4c9';
		ctx.fillRect(0, 0, width, height);

		// title
		ctx.fillStyle = '#967d53';
		ctx.font = 'bold 64px Didot serif';
		ctx.textBaseline = 'top';
		ctx.fillText(project.title || '', 40, 32);

		// organization and dates
		ctx.fillStyle = '#967d53';
		ctx.font = 'bold italic 38px Didot serif';
		ctx.fillText(project.organization || '', 40, 120);
		const dates = (project.startDate || '') + (project.endDate ? ' - ' + project.endDate : '');
		// right align dates
		ctx.font = 'italic 28px Didot serif';
		const datesWidth = ctx.measureText(dates).width;
		ctx.fillText(dates, 40 + (width - 80) - datesWidth, 120);

		// divider
		ctx.fillStyle = '#967d53';
		ctx.fillRect(40, 180, width - 80, 2);

		// description (wrap text)
		ctx.fillStyle = '#967d53';
		ctx.font = '32px Didot serif';
		const desc = project.description || '';
		const maxWidth = width - 80;
		let y = 210;
		const lineHeight = 34;
		const words = desc.split(' ');
		let line = '';
		for (let n = 0; n < words.length; n++) {
			const testLine = line + words[n] + ' ';
			const metrics = ctx.measureText(testLine);
			const testWidth = metrics.width;
			if (testWidth > maxWidth && n > 0) {
				ctx.fillText(line, 40, y);
				line = words[n] + ' ';
				y += lineHeight;
			} else {
				line = testLine;
			}
		}
		ctx.fillText(line, 40, y);

		// link text
		ctx.fillStyle = '#c09f70';
		ctx.font = '32px Didot serif';
		ctx.fillText(project.linkText || 'Visit Project', 40, height - 120);

		// tags
		ctx.fillStyle = '#967d53';
		ctx.font = '32px Didot serif';
		ctx.fillText('[' + (project.tags || []).join(', ') + ']', 40, height - 60);

		return canvas;
	}

	showCardModal(project, cardElement) {
		if (!project) return;
		// populate modal with project info
		const modal = document.getElementById('project-modal');
		modal.querySelector('.modal-body').innerHTML = cardElement.innerHTML;
		
		modal.style.display = 'flex';
		UIState.interactionEnabled = false;

		// close modal event
		modal.querySelector('.close').onclick = () => {
			modal.style.display = 'none';
			UIState.interactionEnabled = true;
		}
	}
	
	// manage animations crossfade
	swapAnimations(toPlay) {
		const current = this.baseActions[this.currentAction];
		const next = this.baseActions[toPlay];
		
		next.action.reset();
		next.action.play();
		next.action.crossFadeFrom(current.action, 0.5, true);
		
		this.currentAction = toPlay;
	}

	// animate camera movement
	cameraCinematicMove(newPosition, newTarget, duration = 1000, callback = null) {
		const startPosition = this.camera.position.clone();
		const startTarget = this.controls.target.clone();
		const startTime = performance.now();

		const animateCamera = (time) => {
			const elapsed = time - startTime;
			const t = Math.min(elapsed / duration, 1); // normalized time [0,1]

			this.camera.position.lerpVectors(startPosition, newPosition, t);
			this.controls.target.lerpVectors(startTarget, newTarget, t);
			this.controls.update();

			if (t < 1) {
				requestAnimationFrame(animateCamera);
			}
			if (callback) callback();
		};

		requestAnimationFrame(animateCamera);
	}
}

let app = new App();
app.init();
window.global = {app:app};
export { app, App };
