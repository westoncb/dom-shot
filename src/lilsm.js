import isNil from "lodash.isnil"

class LilSM {
    states = [] // format: {name, onExit, onEnter}
    transitions = [] // format: {name, onExit, onEnter, initial, final, duration}
    currentState = null

    constructor(states, transitions, initialStateName, name) {
        this.states = states.map(s => ({
            ...s,
            onExit: s.onExit ?? (() => {}),
            onEnter: s.onEnter ?? (() => {}),
        }))
        this.transitions = transitions.map(t => ({
            ...t,
            onExit: t.onExit ?? (() => {}),
            onEnter: t.onEnter ?? (() => {}),
        }))

        this.setCurrentState(initialStateName)

        LilSM.register(this, name)
    }

    static register(stateMachine, name) {
        if (!LilSM.registry) {
            LilSM.registry = {}
        }

        const id = name ?? "SM: " + Number(Math.random() * 1000).toFixed()
        LilSM.registry[id] = stateMachine
    }

    current() {
        return this.currentState
    }

    transition(transitionName) {
        if (this.isTransitionValid(transitionName)) {
            const transition = this.getTransition(transitionName)

            this.currentState.onExit()
            transition.onEnter()

            if (!isNil(transition.duration)) {
                // we allow transitions to be states implicitly
                this.currentState = transition
                transition.timePassed = 0
            } else {
                transition.onExit()
                this.setCurrentState(transition.final)
            }
        } else {
            console.error(
                `attempted invalid transition '${transitionName}' from state '${this.currentState.name}'`
            )
        }
    }

    transitioning() {
        return !isNil(this.getTransition(this.currentState.name, true))
    }

    getTransition(name, skipAssert) {
        const transition = this.transitions.find(t => t.name === name)
        if (!skipAssert) {
            console.assert(
                !isNil(transition),
                "Invalid transition name:" + name
            )
        }
        return transition
    }

    getState(name, skipAssert) {
        const state = this.states.find(s => s.name === name)
        if (!skipAssert) {
            console.assert(!isNil(state), "Invalid state name:" + name)
        }
        return state
    }

    isTransitionValid(transitionName) {
        return this.outgoingTransitions(this.currentState.name)
            .map(t => t.name)
            .includes(transitionName)
    }

    outgoingTransitions(stateName) {
        return this.transitions.filter(t => t.initial === stateName)
    }

    incomingTransitions(stateName) {
        return this.transitions.filter(t => t.final === stateName)
    }

    setCurrentState(name) {
        this.currentState = this.getState(name)
        this.currentState.onEnter()
    }

    update(deltaTime) {
        if (this.transitioning()) {
            const transition = this.getTransition(this.currentState.name)
            transition.timePassed += deltaTime
            transition.completionRatio =
                transition.timePassed / transition.duration

            if (transition.completionRatio >= 1) {
                transition.completionRatio = 1
                transition.onExit()
                this.setCurrentState(transition.final)
            }
        }
    }

    static getSM(name) {
        return LilSM.registry[name]
    }

    static globalUpdate(deltaTime) {
        for (const name of Object.keys(LilSM.registry)) {
            LilSM.registry[name].update(deltaTime)
        }
    }
}

export default LilSM
