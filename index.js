import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

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

        this.gltfLoader = null;
		
		this.projects = [];
		this.frames = [];

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.intersectedFrame = null;
		this.mainFrame = null;

		this.textureLoader = new THREE.TextureLoader();
	}

	onMouseMove( event ) {
		// calculate mouse position in normalized device coordinates
		// (-1 to +1) for both components
		this.mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		this.mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
	}

	onMouseClick( event ) {
		if (this.intersectedFrame) {
			const projectTitle = this.intersectedFrame.name;
			console.log('Clicked on project:', projectTitle);
			// show more info about the project
			const project = this.projects.find(p => p.title === projectTitle);
			if (project) {
				const info = `Title: ${project.title}\nOrganization: ${project.organization}\nLink: ${project.link}\nDescription: ${project.description}`;
				alert(info);
				// show in a better way later
			}
		}
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

		window.addEventListener( 'resize', this.onWindowResize.bind(this) );
		window.addEventListener( 'mousemove', this.onMouseMove.bind(this), false );
		window.addEventListener( 'click', this.onMouseClick.bind(this), false );
	
		// include lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
		this.scene.add(ambientLight);

		const dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
		dirLight.position.set( -2, 10, 0 );
		dirLight.castShadow = true;
		dirLight.shadow.radius = 4;
		dirLight.shadow.bias = - 0.0005;
		const helper = new THREE.CameraHelper(dirLight.shadow.camera);
		//this.scene.add(helper);

		const dirGroup = new THREE.Group();
		dirGroup.add( dirLight );
		this.scene.add( dirGroup );

		const pointLight = new THREE.PointLight(0xffffff, 1.0);
		pointLight.position.y = 7;
		// this.scene.add(pointLight);

		this.lights.push(ambientLight, dirLight, pointLight);

        // Instantiate a loader
        this.gltfLoader = new GLTFLoader();

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
			
			// this.mixerAvatar = new THREE.AnimationMixer( this.carol );
			// this.mixerAvatar.clipAction( gltf.animations[ 0 ] ).play();

			const skeleton = new THREE.SkeletonHelper(this.carol);
			// this.scene.add(skeleton);  // Optional: to visualize the skeleton
	
			// Load the Mixamo animation
			this.gltfLoader.load('./data/animations/sad.glb', (gltf) => {
				const animation = gltf.animations[0];  // Assuming it's the first animation

				// Create an AnimationMixer for your avatar
				this.mixerAvatar = new THREE.AnimationMixer(this.carol);

				// Create an action for the Mixamo animation and play it
				const action = this.mixerAvatar.clipAction(animation);
				action.play();
				}, undefined, function(error) {
				console.error('An error occurred while loading the animation:', error);
			});

			}
		);

		// jukebox
        this.gltfLoader.load( './data/record_player/scene.gltf', ( gltf ) => {
			this.jukebox = gltf.scene;
			this.jukebox.name = "jukebox";
			this.jukebox.scale.set(0.5,0.5,0.5);
			this.jukebox.position.y = 1.5;

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

			this.scene.add( this.jukebox );

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
				this.frames[i].position.set(-7 + i*3.5, 3, -9.9); // change location of frame
				
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
					plane.position.set(0,0,0.1); // slightly in front of the frame
					
					this.frames[i].add(plane);
				});

				// add to scene
				this.scene.add(this.frames[i]);
			}
		})
		.catch(error => {
			console.error('Error loading projects data:', error);
		});

	} // end init

	onWindowResize() {

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );

		this.animate();

	}

    animate() {

        requestAnimationFrame( this.animate.bind(this) );
		
		// raycaster
		this.raycaster.setFromCamera( this.mouse, this.camera );
		const intersects = this.raycaster.intersectObjects( this.frames, true );

		// reset all frames
		this.frames.forEach( (frame) => {
			frame.children[0].material.emissive = new THREE.Color(0x000000);
		});

		// highlight intersected frame
		for ( let i = 0; i < intersects.length; i++ ) {
			this.intersectedFrame = intersects[i].object.parent;
			this.intersectedFrame.children[0].material.emissive = new THREE.Color(0x222222);
		}
		// change cursor style
		if ( intersects.length > 0 ) {
			$('html, body').css('cursor', 'pointer');
		} else {
			$('html, body').css('cursor', 'default');
			this.intersectedFrame = null;
		}
		const delta = this.clock.getDelta();
		this.mixerMusic.update( delta );
		if (this.mixerAvatar) this.mixerAvatar.update( delta );
		if (this.carol) {
			this.carol.position.x = 2.5;
			this.carol.scale.set(1.65,1.65,1.65);
		}

		this.controls.update();

		this.renderer.render( this.scene, this.camera );
    }
}

let app = new App();
app.init();
window.global = {app:app};
export { app, App };
