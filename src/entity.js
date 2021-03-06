import { Box3, Vector3 } from "three"

const DEFAULT_FRICTION_COEFFICIENT = 0.96
const MAX_SPEED = 1600

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

        // define to override default
        // this.frictionCoefficient = 0.9
        // this.maxSpeed = 1000
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

        const maxSpeed = this.maxSpeed ?? MAX_SPEED
        this.velocity.set(
            Math.min(maxSpeed, this.velocity.x),
            Math.min(maxSpeed, this.velocity.y),
            Math.min(maxSpeed, this.velocity.z)
        )

        // 'friction'
        this.velocity.copy(
            this.velocity
                .clone()
                .multiplyScalar(
                    this.frictionCoeffecient ?? DEFAULT_FRICTION_COEFFICIENT
                )
        )

        this.obj3d.position.add(this.velocity.clone().multiplyScalar(deltaTime))

        this.angle += deltaTime * this.angularVelocity.z
        this.obj3d.rotation.z = this.angle
    }

    handleCollision(otherEntity, intersection) {}

    dispose() {}
}

export default Entity
