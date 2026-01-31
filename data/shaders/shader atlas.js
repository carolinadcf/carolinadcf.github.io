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

    float hash1(float n) {
        return fract(sin(n) * 43758.5453);
    }

    void main() {
        vec2 uv = vUv;

        // horizontal jitter
        float jitter =
            (hash1(floor(uv.y * 240.0) + floor(time * 30.0)) - 0.5) * 0.004;

        // bad scanline
        float lineRand = hash1(floor(uv.y * 60.0) + floor(time * 2.0));
        float badLine = step(0.985, lineRand);
        float badOffset = badLine * (hash1(floor(time * 10.0)) - 0.5) * 0.03;

        // corrupted UVs
        vec2 corruptedUV = vec2(
            uv.x + jitter + badOffset,
            uv.y
        );

        // sample source
        vec3 color = texture2D(tDiffuse, corruptedUV).rgb;

        // grayscale
        float gray = dot(color, vec3(0.299, 0.587, 0.114));

        // scanline interference
        gray += 0.08 * sin(500.0 * uv.y + 5.0 * time);

        // cheap lens vignette
        float vignette = smoothstep(0.9, 0.4, distance(uv, vec2(0.5)));
        gray *= vignette;

        gl_FragColor = vec4(vec3(gray), 1.0);
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