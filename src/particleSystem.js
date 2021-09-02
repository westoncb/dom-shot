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
    minSpawnRate: 10,
    maxSpawnRate: 20,
    minSpawnSpeed: 5, // start particle properties
    maxSpawnSpeed: 20,
    minSpawnDirection: new Vector3(0, 1, 0),
    maxSpawnDirection: new Vector3(0, 1, 0),
    minDeathDirection: new Vector3(0, 1, 0),
    maxDeathDirection: new Vector3(0, 1, 0),
    minAccel: 2,
    maxAccel: 3,
    minLifetime: 0.5,
    maxLifetime: 2,
    spawnColorA: new Color("#ff2299"),
    spawnColorB: new Color("#9922ff"),
    deathColorA: new Color("#22ff44"),
    deathColorB: new Color("#44ff22"),
    spawnSizeA: new Vector2(80, 80),
    spawnSizeB: new Vector2(100, 100),
    deathSizeA: new Vector2(20, 20),
    deathSizeB: new Vector2(40, 40),
    colorFunc: t => {
        scratchColor.setRGB(0.1, 0.9, 0.3)
        return scratchColor
    },
    sizeFunc: t => {
        return 1
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
        this.particleConfigs.fill({}, 0, particleCount)
        this.particleProps.fill({}, 0, particleCount)

        this.geo = new BufferGeometry()
        this.geo.setAttribute(
            "position",
            new Float32BufferAttribute(this.positions, 3).setUsage(
                DynamicDrawUsage
            )
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
            uniforms: this.uniforms,
            vertexShader: ParticleSystem.getVertexShader(),
            fragmentShader: ParticleSystem.getFragmentShader(userFragShader),

            blending: AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true,
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
            if (id < 5 && id > -1) {
                console.log("spawning!", this.particleConfigs[id])
            }
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
        const positions = this.positions
        const colors = this.colors
        const sizes = this.sizes
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
        const position = sv2.set(
            positions[index * 3 + 0],
            positions[index * 3 + 1],
            positions[index * 3 + 2]
        )
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

        const color = pprops.color.lerpColors(
            pc.spawnColor,
            pc.deathColor,
            easedCompletion
        )
        colors[index * 4 + 0] = color.r
        colors[index * 4 + 1] = color.g
        colors[index * 4 + 2] = color.b
        colors[index * 4 + 2] = color.a

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
    }

    nextFreeIndex() {
        for (let i = 0; i < this.particleFreeList.length; i++) {
            if (this.particleFreeList[i]) {
                return i
            }
        }

        return -1
    }

    kill(index) {}

    setNextSpawnDelay() {
        this.spawnDelay =
            1 / rand(this.config.minSpawnRate, this.config.maxSpawnRate)
    }

    static getDefaultFragShader() {
        return `
            void main() {

				gl_FragColor = vColor;
			}
        `
    }

    static getFragmentShader(userPart) {
        return `
			varying vec4 vColor;

			${userPart}

			`
    }

    static getVertexShader() {
        return `
            attribute float size;

			varying vec4 vColor;

			void main() {

				vColor = color;

				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

				gl_PointSize = size * ( 300.0 / -mvPosition.z );

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
