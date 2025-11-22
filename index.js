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

class App {

    constructor() {
        
        this.fps = 0;
        this.elapsedTime = 0; // clock is ok but might need more time control to dinamicaly change signing speed
        this.clock = new THREE.Clock();
		this.day = 0;
		this.dayData = 0;

        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;        
		this.lights = [];
		
		// projects and frames
		this.projects = [];
		this.frames = [];

		// raycaster
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.intersectedFrame = null;
		this.mainFrame = null;
		this.selectedJukebox = false;

        // instantiate loaders
		this.textureLoader = new THREE.TextureLoader();
        this.gltfLoader = new GLTFLoader();
		this.audioLoader = new THREE.AudioLoader();

		// animation mixers
		this.mixerMusic = null;
		this.mixerAvatar = null;

		// actions
		this.currentAction = 'sad';
		this.idleAction = 'sad';
		this.baseActions = {
			sad: {weight: 1},
			wave: {weight: 0}
		};

		// positional audio for record player
		this.jukebox = null;
		this.vinyl = null;
		this.sound = null;
		this.listener = new THREE.AudioListener();

		// postprocessing
		this.composer = null;
		this.renderPass = null;
		this.outlinePass = null;
		this.selectedObjects = [ ];
	}

	init( ) {
		// scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0x4d575e );

		// renderer
		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.VSMShadowMap;
		
        this.renderer.toneMapping = THREE.CineonToneMapping ;
        this.renderer.toneMappingExposure = 1;
		document.body.appendChild( this.renderer.domElement );

		// camera
		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
		this.camera.position.set( 0, 2, 10 );

		// controls
		this.controls = new OrbitControls( this.camera, this.renderer.domElement );
		this.controls.target.set( 0, 3, 0 );
		this.controls.maxDistance = 15;
		this.controls.maxPolarAngle = Math.PI / 2;
		this.controls.update();

		// event listeners
		window.addEventListener( 'resize', this.onWindowResize.bind(this) );
		window.addEventListener( 'mousemove', this.onMouseMove.bind(this), false );
		window.addEventListener( 'click', this.onMouseClick.bind(this), false );
		this.controls.addEventListener( 'change', () => {
			document.getElementById('visit-link-button').style.display = 'none';
			document.getElementById('back-button').style.display = 'none';
		} );
		document.getElementById('back-button').addEventListener('click', () => {
			// move camera back to original position
			const newCameraPosition = new THREE.Vector3(0, 2, 10);
			const newTargetPosition = new THREE.Vector3(0, 3, 0);

			// animate camera movement
			this.cameraCinematicMove(newCameraPosition, newTargetPosition, 1000);

			document.getElementById('visit-link-button').style.display = 'none';
			document.getElementById('back-button').style.display = 'none';
		});
		
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

			const skeleton = new THREE.SkeletonHelper(this.carol);
			// this.scene.add(skeleton);  // Optional: to visualize the skeleton
	
			// Create an AnimationMixer for your avatar
			this.mixerAvatar = new THREE.AnimationMixer(this.carol);

			// Load the Mixamo animation
			this.gltfLoader.load('./data/animations/sad.glb', (gltf) => {
				const animation = gltf.animations[0];  // Assuming it's the first animation
				animation.name = "sad"; // rename animation
				
				// Create an action for the Mixamo animation and play it
				this.baseActions.sad.action = this.mixerAvatar.clipAction(animation);
				this.baseActions.sad.action.play();
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

			// when wave ends, go back to idle (sad)
			this.mixerAvatar.addEventListener('finished', (e) => {
				if (e.action === this.baseActions.wave.action) {
					this.swapAnimations(this.idleAction);
				}
			});
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
					this.frames[i].position.set(-9.9, 3, 4 - i*4);
					this.frames[i].rotation.y = Math.PI / 2;
				}
				// front wall
				else if (i < 6) {
					this.frames[i].position.set(-2 + (i-3)*4, 3, -9.9);
				}
				// this.frames[i].position.set(-7 + i*4, 3, -9.9); // change location of frame
				
				// create texture with project image					
				this.textureLoader.load( project.image, (texture) => {
					texture.colorSpace = THREE.SRGBColorSpace;
					
					// plane with image of its size
					const planeGeometry = new THREE.PlaneGeometry();
					// adjust plane size based on image aspect ratio
					const imageAspect = texture.image.width / texture.image.height;
					const planeHeight = 2; // desired height
					const planeWidth = planeHeight * imageAspect;
					planeGeometry.scale(planeWidth, planeHeight, 1);
					
					const planeMaterial = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false});
					const plane = new THREE.Mesh(planeGeometry, planeMaterial);
					this.frames[i].add(plane);
					
					// back plane (frame)
					const backGeometry = new THREE.PlaneGeometry();
					backGeometry.scale(planeWidth + 0.1, planeHeight + 0.1, 1);
					const backMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, side: THREE.DoubleSide });
					const backPlane = new THREE.Mesh(backGeometry, backMaterial);
					backPlane.position.z = -0.01; // slightly behind the image
					this.frames[i].add(backPlane);

					// card info
					const cardGeometry = new THREE.PlaneGeometry();
					cardGeometry.scale(0.7, 0.5, 1);
					
					// add text info to card using canvas texture
					const canvas = document.createElement('canvas');
					const context = canvas.getContext('2d');
					// white background
					context.fillStyle = 'white';
					context.fillRect(0, 0, canvas.width, canvas.height);
					context.fillStyle = 'black';
					// project title
					context.font = "24px Didot";
					context.fillText(project.title, 20, 40);
					// description - dont overflow
					context.font = "16px Didot";
					const descriptionLines = [];
					const words = project.description.split(' ');
					let line = '';
					words.forEach((word) => {
						const testLine = line + word + ' ';
						const metrics = context.measureText(testLine);
						const testWidth = metrics.width;
						if (testWidth > canvas.width - 40 && line !== '') {
							descriptionLines.push(line);
							line = word + ' ';
						} else {
							line = testLine;
						}
					});
					descriptionLines.push(line);
					// draw each line
					descriptionLines.forEach((descLine, index) => {
						context.fillText(descLine, 20, 70 + index * 20);
					});
					
					// organization
					context.font = "14px Didot";
					context.fillText(`${project.organization}`, 20, canvas.height - 40);

					// tags
					context.font = "12px Didot";
					const tagsText = project.tags.join(', ');
					context.fillText(`[${tagsText}]`, 20, canvas.height - 20);

					// start and end date - bottom right
					context.font = "12px Didot";
					// if date undefined don't show
					if (!project.startDate && !project.endDate) {
						// do nothing
					}
					else {
						if (!project.endDate) project.endDate = "";
						if (!project.startDate) project.startDate = "";
						context.fillText(`(${project.startDate} - ${project.endDate})`, canvas.width - 150, canvas.height - 20);
					}					

					// create texture
					const textureCard = new THREE.CanvasTexture(canvas);
					textureCard.needsUpdate = true;

					var cardMaterial = new THREE.MeshBasicMaterial({
						color: 0xffffff,
						map: textureCard,
						side: THREE.DoubleSide,
						toneMapped: false
					});

					const cardPlane = new THREE.Mesh(cardGeometry, cardMaterial);
					// bottom right of the frame
					cardPlane.position.set(planeWidth/2 + 0.6, -planeHeight/2 + 0.25, 0.01);
					this.frames[i].add(cardPlane);
				});

				// add to scene
				this.scene.add(this.frames[i]);
			}
		})
		.catch(error => {
			console.error('Error loading projects data:', error);
		});

		// postprocessing
		this.composer = new EffectComposer(this.renderer);
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.composer.addPass(this.renderPass);

		this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
		this.outlinePass.edgeStrength = 3.0;
		this.outlinePass.edgeGlow = 0.3;
		this.outlinePass.pulsePeriod = 2;

		this.composer.addPass(this.outlinePass);

		this.effectFXAA = new ShaderPass(FXAAShader);
		this.effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
		this.composer.addPass(this.effectFXAA);
		// end postprocessing

		// initialize UI
		initUI();

	} // end init

	onWindowResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
		this.composer.setSize( window.innerWidth, window.innerHeight );

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
		
		// this.renderer.render( this.scene, this.camera );
		this.composer.render();
	}

	addLights() {
		const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
		this.scene.add(ambientLight);

		const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
		dirLight.position.set( -2, 10, 0 );
		dirLight.castShadow = true;
		dirLight.shadow.radius = 4;
		dirLight.shadow.bias = - 0.0005;

		const dirGroup = new THREE.Group();
		dirGroup.add( dirLight );
		this.scene.add( dirGroup );

		this.lights.push(ambientLight, dirLight);
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
		if (this.intersectedFrame) {
			const projectTitle = this.intersectedFrame.name;
			this.showCard(projectTitle); // show more info about the project

			// move camera to the front of the frame
			const framePosition = new THREE.Vector3();
			this.intersectedFrame.getWorldPosition(framePosition);
			framePosition.x += 0.5; // offset to the side
			const frameNormal = new THREE.Vector3(0, 0, 1);
			frameNormal.applyQuaternion(this.intersectedFrame.quaternion);
			// calculate zoom out factor according to frame size
			const zoomOutFactor = this.intersectedFrame.scale.length() * 4;
			const newCameraPosition = framePosition.clone().add(frameNormal.clone().multiplyScalar(zoomOutFactor)).add(new THREE.Vector3(0, 0, 0));

			// animate camera movement
			this.cameraCinematicMove(newCameraPosition, framePosition, 1000, () => {
				// show visit link and back button
				document.getElementById('visit-link-button').style.display = 'inline-block';
				document.getElementById('back-button').style.display = 'inline-block';
			});

		}
		else if (this.jukebox) {
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
					document.getElementById('back-button').style.display = 'inline-block';
				});
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
			frame.children[1].material.emissive = new THREE.Color(0x000000);
			frame.children[1].material.color = new THREE.Color(0x000000);
		});
		
		// highlight intersected frame
		for ( let i = 0; i < intersects.length; i++ ) {
			// highlight border of frame
			this.intersectedFrame = intersects[i].object.parent;
			this.intersectedFrame.children[1].material.color = new THREE.Color(0xffffff);
			this.intersectedFrame.children[1].material.emissive = new THREE.Color(0xffffff);
		}
		
		// change cursor style
		if ( intersects.length > 0 ) { $('html, body').css('cursor', 'pointer'); }
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
		this.outlinePass.selectedObjects = this.selectedObjects;
	}

	showCard(projectTitle) {
		const project = this.projects.find(p => p.title === projectTitle);
		if (!project) return;

		// add clickable functional link
		var link = document.getElementById('visit-link-button');
		link.href = project.link;
		link.target = '_blank';
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
