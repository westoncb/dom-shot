import Entity from "./entity"
import Game from "./game"
import {
    Box3,
    Mesh,
    PlaneBufferGeometry,
    Vector2,
    ShaderMaterial,
    Vector3,
} from "three"

class Arena {
    static create(bbox) {
        const arena = new Entity("arena")
        arena.obj3d = Arena.createMesh(bbox, arena)
        let elapsedSeconds = 0

        arena.customUpdate = deltaTime => {
            elapsedSeconds += deltaTime
            arena.uniforms.time.value = elapsedSeconds
        }

        return arena
    }

    static createMesh(bbox, entity) {
        const bboxSize = new Vector3()
        bbox.getSize(bboxSize)
        entity.width = bboxSize.x
        entity.height = bboxSize.y
        const geo = new PlaneBufferGeometry(entity.width, entity.height)

        // geo.rotateX(Math.PI / 20)

        entity.uniforms = {
            time: { type: "f", value: 1.0 },
            resolution: { type: "v2", value: new Vector2() },
        }

        const mat = new ShaderMaterial({
            uniforms: entity.uniforms,
            vertexShader: Arena.getVertexShader(),
            fragmentShader: Arena.getFragmentShader(),
            transparent: true,
        })
        mat.extensions.derivatives = true

        entity.uniforms.resolution.value.x = window.innerWidth
        entity.uniforms.resolution.value.y = window.innerHeight

        const mesh = new Mesh(geo, mat)
        mesh.position.z = bbox.max.z + 100

        geo.computeBoundingBox()
        entity.boundingBox = geo.boundingBox

        console.log(mesh)

        return mesh
    }

    static getVertexShader() {
        return `
            varying vec2 vUv;
            varying vec3 pos;
            uniform float time;
            uniform vec2 resolution;

            void main() {
                vUv = uv;
                pos = position;

                vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * modelViewPosition;
            }
        `
    }

    static getFragmentShader() {
        return `
            uniform float time;
            uniform vec2 resolution;
            varying vec2 vUv;
            varying vec3 pos;

            // https://www.shadertoy.com/view/Msf3WH
			vec2 hash( vec2 p ) {
			  p = vec2( dot(p,vec2(127.1,311.7)),
			        dot(p,vec2(269.5,183.3)) );
			  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
			}

			// Simplex noise from https://www.shadertoy.com/view/Msf3WH
            float noise( in vec2 p ) {
			  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
			  const float K2 = 0.211324865; // (3-sqrt(3))/6;
			  vec2 i = floor( p + (p.x+p.y)*K1 );
			  
			  vec2 a = p - i + (i.x+i.y)*K2;
			  vec2 o = step(a.yx,a.xy);    
			  vec2 b = a - o + K2;
			  vec2 c = a - 1.0 + 2.0*K2;
			  vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );
			  vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
			  return dot( n, vec3(70.0) );
			}

            void main()	{
                float noiseVal = noise(pos.xy / (100. * (0.95 + sin(time/100.)*0.05)));
                float bgRed = noiseVal/8. + 0.25;

                vec2 coord = pos.xy / 100.;
                vec2 grid = abs(fract(coord - 0.5) - 0.5) / (fwidth(coord) * 2.0);
                float line = min(grid.x, grid.y);
                float gridIntensity = (1.0 - min(line, 1.0)) / 2.0;

                gl_FragColor = vec4(bgRed + gridIntensity, 0.08, 0.7 + gridIntensity, 0.5 * smoothstep(0., 1., time));
            }
        `
    }
}

export default Arena
