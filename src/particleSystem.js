import {
    BufferGeometry,
    Color,
    Points,
    Vector2,
    Vector3,
    Float32BufferAttribute,
    DynamicDrawUsage,
    ShaderMaterial,
    AdditiveBlending,
} from "three"
import {
    colorBetween,
    easeInOutSine,
    rand,
    vectorBetween2d,
    vectorRotatedBetween,
} from "./util"

const scratchColor = new Color()
const sv1 = new Vector3() // scratch vectors
const sv2 = new Vector3()
const sv3 = new Vector3()

const defaultConfig = {
    particleCount: 100, // start generator properties
    minSpawnRate: 4,
    maxSpawnRate: 6,
    minSpawnSpeed: 60, // start particle properties
    maxSpawnSpeed: 90,
    minSpawnDirection: new Vector3(-0.9, 0, 0),
    maxSpawnDirection: new Vector3(0.9, 0, 0),
    minDeathDirection: new Vector3(0, 1, 0),
    maxDeathDirection: new Vector3(1, 0, 0),
    minAccel: 70,
    maxAccel: 85,
    minLifetime: 2,
    maxLifetime: 8,
    spawnOpacity: 1,
    deathOpacity: 0,
    spawnColorA: new Color("#ff2299"),
    spawnColorB: new Color("#99ffff"),
    deathColorA: new Color("#22ff44"),
    deathColorB: new Color("#44ff22"),
    spawnSizeA: new Vector2(70, 70),
    spawnSizeB: new Vector2(100, 100),
    deathSizeA: new Vector2(0, 0),
    deathSizeB: new Vector2(5, 5),
    colorFunc: t => {
        scratchColor.setRGB(0.1, 0.9, 0.3)
        return scratchColor
    },
    sizeFunc: t => {
        return 1
    },
    opacityFunc: t => {
        if (t < 0.1) {
            return easeInOutSine(t * 10)
        } else if (t > 0.1 && t < 0.7) {
            return 1
        } else {
            return easeInOutSine((1 - t) * (1 / 0.3))
        }
    },
}

class ParticleSystem {
    constructor(config = {}, fragmentShader = null) {
        this.config = ParticleSystem.mergeConfigWithDefaults(config)
        const particleCount = this.config.particleCount
        this.colors = new Float32Array(particleCount * 4)
        this.sizes = new Float32Array(particleCount * 2)
        this.positions = new Float32Array(particleCount * 3)
        this.particleFreeList = new Array(particleCount)
        this.particleConfigs = new Array(particleCount)
        this.particleProps = new Array(particleCount)
        this.elapsedTime = 0
        this.timeSinceSpawn = 0
        this.setNextSpawnDelay()

        this.particleFreeList.fill(true, 0, particleCount)
        this.colors.fill(0, 0, particleCount * 4)
        this.sizes.fill(0, 0, particleCount * 2)
        this.positions.fill(0, 0, particleCount * 3)
        for (let i = 0; i < particleCount; i++) {
            this.particleConfigs[i] = {}
            this.particleProps[i] = {}
        }

        this.geo = new BufferGeometry()
        this.geo.setAttribute(
            "position",
            new Float32BufferAttribute(this.positions, 3)
        )
        this.geo.setAttribute(
            "color",
            new Float32BufferAttribute(this.colors, 4).setUsage(
                DynamicDrawUsage
            )
        )
        this.geo.setAttribute(
            "size",
            new Float32BufferAttribute(this.sizes, 2).setUsage(DynamicDrawUsage)
        )

        this.uniforms = {}

        const userFragShader =
            fragmentShader ?? ParticleSystem.getDefaultFragShader()

        const shaderMaterial = new ShaderMaterial({
            vertexShader: ParticleSystem.getVertexShader(),
            fragmentShader: ParticleSystem.getFragmentShader(userFragShader),

            // blending: AdditiveBlending,
            depthTest: false,
            transparent: true,
        })

        this.obj3d = new Points(this.geo, shaderMaterial)
    }

    getObj3d() {
        return this.obj3d
    }

    update(deltaTime) {
        this.elapsedTime += deltaTime
        this.generatorUpdate(deltaTime)

        // update all non-free (i.e. live) particles
        for (let i = 0; i < this.particleFreeList.length; i++) {
            if (!this.particleFreeList[i]) {
                this.updateParticle(i, deltaTime)
            }
        }

        // console.log(this.particleProps[0])
    }

    generatorUpdate(deltaTime) {
        const c = this.config
        this.timeSinceSpawn += deltaTime

        if (this.timeSinceSpawn >= this.spawnDelay) {
            this.setNextSpawnDelay()
            this.timeSinceSpawn = 0
            const id = this.spawnParticle()
        }
    }

    spawnParticle() {
        const id = this.nextFreeIndex()

        if (id > -1) {
            this.particleFreeList[id] = false

            this.generateParticleConfig(id)
            this.initParticle(id)
        }

        return id
    }

    killParticle(id) {
        this.particleFreeList[id] = true
    }

    updateParticle(index, deltaTime) {
        const pc = this.particleConfigs[index]
        const pprops = this.particleProps[index]
        const positions = this.obj3d.geometry.attributes.position.array
        const colors = this.obj3d.geometry.attributes.color.array
        const sizes = this.obj3d.geometry.attributes.size.array
        const completion = (this.elapsedTime - pprops.birthTime) / pc.lifetime

        if (index === 1) {
            // console.log(
            //     completion,
            //     this.elapsedTime,
            //     pprops.birthTime,
            //     pc.lifetime
            // )
        }

        if (completion >= 1) {
            this.killParticle(index)
            return
        }

        const easedCompletion = easeInOutSine(completion)

        const direction = pprops.direction.lerpVectors(
            pc.spawnDirection,
            pc.deathDirection,
            easedCompletion
        )
        pprops.speed += pc.accel * deltaTime
        const velocity = sv1.copy(direction).multiplyScalar(pprops.speed)
        const position = pprops.position
        position.addScaledVector(velocity, deltaTime)
        positions[index * 3 + 0] = position.x
        positions[index * 3 + 1] = position.y
        positions[index * 3 + 2] = position.z

        const size = pprops.size.lerpVectors(
            pc.spawnSize,
            pc.deathSize,
            easedCompletion
        )
        sizes[index * 2 + 0] = size.x
        sizes[index * 2 + 1] = size.y

        if (index === 1) {
            // console.log("X", this.config.opacityFunc(completion))
        }

        const color = pprops.color.lerpColors(
            pc.spawnColor,
            pc.deathColor,
            easedCompletion
        )
        colors[index * 4 + 0] = color.r
        colors[index * 4 + 1] = color.g
        colors[index * 4 + 2] = color.b
        colors[index * 4 + 3] = this.config.opacityFunc(completion)

        this.obj3d.geometry.attributes.size.needsUpdate = true
        this.obj3d.geometry.attributes.color.needsUpdate = true
        this.obj3d.geometry.attributes.position.needsUpdate = true
    }

    generateParticleConfig(index) {
        const c = this.config
        const pc = this.particleConfigs[index]

        pc.spawnSpeed = rand(c.minSpawnSpeed, c.maxSpawnSpeed)
        pc.spawnDirection = vectorRotatedBetween(
            c.minSpawnDirection,
            c.maxSpawnDirection
        )
        pc.deathDirection = vectorRotatedBetween(
            c.minDeathDirection,
            c.maxDeathDirection
        )
        // console.log(pc.spawnDirection)
        pc.accel = rand(c.minAccel, c.maxAccel)
        pc.lifetime = rand(c.minLifetime, c.maxLifetime)
        pc.spawnColor = colorBetween(c.spawnColorA, c.spawnColorB)
        pc.deathColor = colorBetween(c.deathColorA, c.deathColorB)
        pc.spawnSize = vectorBetween2d(c.spawnSizeA, c.spawnSizeB)
        pc.deathSize = vectorBetween2d(c.deathSizeA, c.deathSizeB)
    }

    initParticle(index) {
        const pc = this.particleConfigs[index]
        this.particleProps[index].speed = pc.spawnSpeed
        this.particleProps[index].birthTime = this.elapsedTime
        this.particleProps[index].direction = pc.spawnDirection.clone()
        this.particleProps[index].color = pc.spawnColor.clone()
        this.particleProps[index].size = pc.spawnSize.clone()
        this.particleProps[index].position = new Vector3() // should generate with possible offset radius
    }

    nextFreeIndex() {
        for (let i = 0; i < this.particleFreeList.length; i++) {
            if (this.particleFreeList[i]) {
                return i
            }
        }

        return -1
    }

    setNextSpawnDelay() {
        this.spawnDelay =
            1 / rand(this.config.minSpawnRate, this.config.maxSpawnRate)
    }

    static getDefaultFragShader() {
        return `
            void main() {

                float l = length(vPos);
				gl_FragColor = vec4(vColor.r, vColor.g, vColor.b, vColor.a);
			}
        `
    }

    static getFragmentShader(userPart) {
        return `
            varying vec2 vUv;
            varying vec3 vPos;
			varying vec4 vColor;

			${userPart}
			`
    }

    static getVertexShader() {
        return `
            attribute vec2 size;
            attribute vec4 color;
            
            varying vec2 vUv;
            varying vec3 vPos;
			varying vec4 vColor;

			void main() {

				vColor = color;
                vUv = uv;
                vPos = position;

				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

				gl_PointSize = size.x;

				gl_Position = projectionMatrix * mvPosition;

			}
        `
    }

    static mergeConfigWithDefaults(config) {
        Object.keys(defaultConfig).forEach(
            key => (config[key] = config[key] ?? defaultConfig[key])
        )
        return config
    }
}

export default ParticleSystem
