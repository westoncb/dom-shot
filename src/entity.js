import { Box3, Vector3 } from "three"

const FRICTION_COEFFICIENT = 0.96
const MAX_VELOCITY = 1600

class Entity {
    constructor(type, bounds, obj3d) {
        this.type = type
        this.bounds = bounds
        this.obj3d = obj3d

        this.acceleration = new Vector3()
        this.velocity = new Vector3()
        this.direction = new Vector3(0, 1, 0)
        this.angularVelocity = new Vector3()
        this.angle = 0
    }

    init() {
        if (this.customInit) {
            this.customInit()
        }
    }

    update(deltaTime) {
        if (this.customUpdate) {
            this.customUpdate(deltaTime)
        }

        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime))
        this.velocity.set(
            Math.min(MAX_VELOCITY, this.velocity.x),
            Math.min(MAX_VELOCITY, this.velocity.y),
            Math.min(MAX_VELOCITY, this.velocity.z)
        )

        // 'friction'
        this.velocity.copy(
            this.velocity.clone().multiplyScalar(FRICTION_COEFFICIENT)
        )

        this.obj3d.position.add(this.velocity.clone().multiplyScalar(deltaTime))

        this.angle += deltaTime * this.angularVelocity.z
        this.obj3d.rotation.z = this.angle
    }

    handleCollision(otherEntity, intersection) {}

    dispose() {}
}

export default Entity
