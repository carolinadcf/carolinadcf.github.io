const securityVertexShader = /* glsl */`
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
`;

const securityFragmentShader = /* glsl */`
    #include <common>

    varying vec2 vUv;    
    
    uniform sampler2D tDiffuse;
    uniform float time;

    void main() {
        vec4 color = texture2D( tDiffuse, vUv );
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        gray += 0.1 * sin(10.0 * vUv.y + time * 5.0);
        gl_FragColor = vec4(vec3(gray), color.a);
    }
`;

const securityShader = {
    uniforms: {
        'tDiffuse': null, // will be set by THREE.js
        'time': { value: 0.0 }
    },
    vertexShader: securityVertexShader,
    fragmentShader: securityFragmentShader
}

export { securityShader };