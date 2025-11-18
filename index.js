import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
		
        // frame
        this.gltfLoader.load( './data/picture_frame/scene.gltf', ( gltf ) => {
			this.frame = gltf.scene;
			this.frame.name = "frame";
			this.frame.scale.set(0.01, 0.01, 0.01);
			this.frame.position.set(-10, 2.5, -1);

			gltf.scene.traverse(function (child) {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});

			this.scene.add( this.frame );

			// let framecontrol = new TransformControls(this.camera, this.renderer.domElement);
			// framecontrol.attach(this.frame);
			// this.scene.add(framecontrol);
			// framecontrol.addEventListener("dragging-changed", (e) => {this.controls.enabled = !e.value})
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

			const texture = new THREE.TextureLoader().load( './data/carol.png' );
			texture.colorSpace = THREE.SRGBColorSpace;
			this.vinyl.material.map = texture;

			this.mixer2 = new THREE.AnimationMixer( this.jukebox );
			this.mixer2.clipAction( gltf.animations[ 0 ] ).play();

			this.scene.add( this.jukebox );

            }
        );

		// load projects data
		fetch('./data/cv.json')
		.then(response => response.json())
		.then(data => {
			this.projects = data;
			console.log('Projects data loaded:', this.projects);
			// You can now use this.projects in your application
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
		
		const delta = this.clock.getDelta();
		this.mixer2.update( delta );
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
