/**
 * A miniature React + DOM shim, just enough to render the client bundle in Node.
 *
 * The failure this exists for is the one no string assertion can catch: a
 * component that throws while rendering makes the host clear the whole slot and
 * log `slot entry crashed`, with the user seeing nothing. Rendering the real
 * component tree here turns that into a failing test.
 *
 * It supports function components, fragments and the five hooks the client uses
 * (useState / useEffect / useMemo / useCallback / useRef). There is no
 * reconciliation: a state change re-renders the tree from the root and reuses
 * each component instance's hook slots by tree path, which is enough for a
 * stateless-data panel whose child components are keyed by symbol.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientPath = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'client.js')

export const FRAGMENT = Symbol('Fragment')

function depsChanged(previous, next) {
  if (previous === undefined || next === undefined) return true
  if (previous === null || next === null) return previous !== next
  if (previous.length !== next.length) return true
  return previous.some((value, index) => !Object.is(value, next[index]))
}

export function createHarness({ fetchImpl, hidden = false, metrics } = {}) {
  const layout = { scrollWidth: 900, clientWidth: 600, ...metrics }
  const storage = new Map()
  const timers = []
  const instances = new Map()
  const elements = new Map()
  const pendingEffects = []
  let timerId = 0
  let dirty = false
  let currentInstance = null

  const windowListeners = new Map()
  const window = {
    __ModuleLoader__: { load: (definition) => (window.__definition = definition) },
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, [])
      windowListeners.get(type).push(listener)
    },
    removeEventListener(type, listener) {
      const list = windowListeners.get(type) ?? []
      const index = list.indexOf(listener)
      if (index >= 0) list.splice(index, 1)
    },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    setTimeout: (fn, ms) => {
      const id = (timerId += 1)
      timers.push({ id, fn, ms: ms ?? 0 })
      return id
    },
    clearTimeout: (id) => {
      const index = timers.findIndex((timer) => timer.id === id)
      if (index >= 0) timers.splice(index, 1)
    },
    setInterval: () => 0,
    clearInterval: () => undefined,
    getComputedStyle(node) {
      return node?.__computed ?? { display: 'block', flexDirection: 'row', flexWrap: 'nowrap' }
    },
  }

  // A tiny DOM: `ensureStyles` needs createElement/head/querySelector, and the
  // tests assert that the stylesheet is appended exactly once.
  const styles = []
  const document = {
    hidden,
    head: {
      appendChild(node) {
        styles.push(node)
        return node
      },
    },
    body: { appendChild: (node) => styles.push(node) },
    createElement(tag) {
      return {
        tag,
        attributes: {},
        textContent: '',
        setAttribute(name, value) {
          this.attributes[name] = value
        },
        getAttribute(name) {
          return this.attributes[name]
        },
      }
    },
    querySelector(selector) {
      const match = /style\[data-plugin-css="([^"]+)"\]/.exec(String(selector))
      if (!match) return null
      return styles.find((node) => node.attributes?.['data-plugin-css'] === match[1]) ?? null
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }

  const React = {
    Fragment: FRAGMENT,
    createElement(type, props, ...children) {
      const merged = { ...props }
      if (children.length === 1) merged.children = children[0]
      else if (children.length > 1) merged.children = children
      return { __el: true, type, props: merged }
    },
    useState(initial) {
      const instance = currentInstance
      const index = instance.index++
      if (!instance.hooks[index]) instance.hooks[index] = { value: typeof initial === 'function' ? initial() : initial }
      const slot = instance.hooks[index]
      return [
        slot.value,
        (next) => {
          const value = typeof next === 'function' ? next(slot.value) : next
          if (!Object.is(value, slot.value)) {
            slot.value = value
            dirty = true
          }
        },
      ]
    },
    useEffect(fn, deps) {
      const instance = currentInstance
      const index = instance.index++
      const slot = instance.hooks[index] ?? (instance.hooks[index] = { deps: undefined, cleanup: undefined })
      if (depsChanged(slot.deps, deps)) {
        slot.deps = deps
        pendingEffects.push({ slot, fn })
      }
    },
    useMemo(fn, deps) {
      const instance = currentInstance
      const index = instance.index++
      const slot = instance.hooks[index]
      if (!slot || depsChanged(slot.deps, deps)) {
        instance.hooks[index] = { deps, value: fn() }
        return instance.hooks[index].value
      }
      return slot.value
    },
    useCallback(fn, deps) {
      const instance = currentInstance
      const index = instance.index++
      const slot = instance.hooks[index]
      if (!slot || depsChanged(slot.deps, deps)) {
        instance.hooks[index] = { deps, value: fn }
        return fn
      }
      return slot.value
    },
    useRef(initial) {
      const instance = currentInstance
      const index = instance.index++
      if (!instance.hooks[index]) instance.hooks[index] = { current: initial }
      return instance.hooks[index]
    },
  }

  function renderTree(node, path) {
    if (node === null || node === undefined || node === false || node === true) return null
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map((child, index) => renderTree(child, `${path}/${index}`))
    if (!node.__el) return null
    if (node.type === FRAGMENT) return renderTree(node.props.children, `${path}/f`)

    if (typeof node.type === 'function') {
      const instance = instances.get(path) ?? { hooks: [], index: 0, component: node.type }
      instances.set(path, instance)
      const previous = currentInstance
      currentInstance = instance
      instance.index = 0
      let output
      try {
        output = node.type(node.props)
      } finally {
        currentInstance = previous
      }
      return renderTree(output, `${path}>`)
    }

    const element =
      elements.get(path) ??
      ({
        listeners: new Map(),
        scrollLeft: 0,
        addEventListener(type, listener) {
          if (!this.listeners.has(type)) this.listeners.set(type, [])
          this.listeners.get(type).push(listener)
        },
        removeEventListener(type, listener) {
          const list = this.listeners.get(type) ?? []
          const index = list.indexOf(listener)
          if (index >= 0) list.splice(index, 1)
        },
        dispatch(type, event) {
          for (const listener of this.listeners.get(type) ?? []) listener(event)
        },
        contains(target) {
          if (target === this) return true
          const walkChildren = (value) => {
            if (value === null || value === undefined) return false
            if (Array.isArray(value)) return value.some(walkChildren)
            if (typeof value !== 'object') return false
            if (value === target) return true
            return walkChildren(value.children)
          }
          return walkChildren(this.children)
        },
        getBoundingClientRect() {
          return { left: 0, top: 0, right: layout.clientWidth, bottom: 40, width: layout.clientWidth, height: 40 }
        },
      })
    elements.set(path, element)
    element.tag = node.type
    element.props = node.props
    element.style = element.style ?? {}
    element.tagName = String(node.type).toUpperCase()
    if (node.props?.['data-plugin'] === 'stock-ticker' && node.props?.['data-variant'] === 'dock') {
      // Reproduce DSH's real slot outlet: a display:contents [data-slot] element
      // between the dock flex row and the entry content.
      const dock = element.__dock ?? {
        tagName: 'DIV',
        className: 'uiqlVW_dock',
        style: {},
        __computed: { display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' },
        parentElement: null,
        closest: () => null,
      }
      const outlet = element.__outlet ?? {
        tagName: 'DIV',
        className: '',
        style: {},
        __computed: { display: 'contents', flexDirection: 'row', flexWrap: 'nowrap' },
        parentElement: dock,
        closest: () => null,
      }
      element.__dock = dock
      element.__outlet = outlet
      outlet.firstElementChild = element
      element.parentElement = outlet
    }
    element.scrollWidth = layout.scrollWidth
    element.clientWidth = layout.clientWidth
    element.children = renderTree(node.props.children, `${path}/${node.type}`)
    const ref = node.props.ref
    if (ref && typeof ref === 'object') ref.current = element
    else if (typeof ref === 'function') ref(element)
    return element
  }

  function runEffects() {
    const queue = pendingEffects.splice(0, pendingEffects.length)
    for (const { slot, fn } of queue) {
      if (typeof slot.cleanup === 'function') {
        try {
          slot.cleanup()
        } catch {
          /* a failing cleanup must not hide the render result */
        }
      }
      const cleanup = fn()
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined
    }
  }

  let rootComponent = null
  let rootProps = {}
  let tree = null

  function renderRoot() {
    const output = renderTree({ __el: true, type: rootComponent, props: rootProps }, 'root')
    runEffects()
    return output
  }

  return {
    React,
    window,
    document,
    /** Elements appended to `document.head` (the single style tag lives here). */
    styles,
    /** Rendered host elements, keyed by tree path (refs and event dispatch). */
    elements,
    findElement(predicate) {
      for (const element of elements.values()) {
        if (predicate(element)) return element
      }
      return undefined
    },
    /** Fire a window listener registered by the client (wheel, scroll, ...). */
    dispatchWindow(type, event) {
      const list = [...(windowListeners.get(type) ?? [])]
      for (const listener of list) listener(event)
    },
    /** Load the client bundle and return its plugin definition. */
    boot() {
      const source = readFileSync(clientPath, 'utf8')
      const globals = globalThis
      globals.window = window
      globals.document = document
      globals.fetch = fetchImpl
      const requireStub = (name) => {
        if (name === 'react') return React
        throw new Error(`unexpected require(${name})`)
      }
      // eslint-disable-next-line no-new-func
      new Function('require', source)(requireStub)
      const definition = window.__definition
      if (!definition) throw new Error('client bundle did not call __ModuleLoader__.load')
      return definition
    },
    mount(component, props) {
      // A different root component must not inherit the previous one's hook
      // slots: the paths would collide and the second component would read the
      // first one's state.
      if (rootComponent !== null && rootComponent !== component) instances.clear()
      rootComponent = component
      rootProps = props ?? {}
      dirty = false
      tree = renderRoot()
      return tree
    },
    getTree() {
      return tree
    },
    /** Re-render while state changes and effects keep settling. */
    async settle(rounds = 20) {
      for (let round = 0; round < rounds; round += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (!dirty && pendingEffects.length === 0) return tree
        tree = renderRoot()
      }
      return tree
    },
    /** Fire the harness timers (debounced search and notice timers). */
    async flushTimers(maxMs = 1000) {
      // The effect that schedules the debounce only runs after a render, so let
      // the pending state change commit before firing anything.
      await this.settle()
      const due = timers.filter((timer) => timer.ms <= maxMs)
      for (const timer of due) {
        const index = timers.indexOf(timer)
        if (index >= 0) timers.splice(index, 1)
      }
      for (const timer of due) timer.fn()
      return this.settle()
    },
  }
}

/* ----------------------------------------------------------- tree helpers */

export function walk(node, visit, parent = null) {
  if (node === null || node === undefined) return
  if (typeof node === 'string') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit, parent)
    return
  }
  visit(node, parent)
  const children = node.children
  if (Array.isArray(children)) for (const child of children) walk(child, visit, node)
  else walk(children, visit, node)
}

export function textOf(node) {
  let out = ''
  const collect = (value) => {
    if (value === null || value === undefined || value === false || value === true) return
    if (value.tag === 'style') return
    if (typeof value === 'string' || typeof value === 'number') {
      out += String(value)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item)
      return
    }
    if (value.children !== undefined) collect(value.children)
  }
  collect(node)
  return out
}

export function findAll(node, predicate, out = []) {
  walk(node, (element) => {
    if (predicate(element)) out.push(element)
  })
  return out
}

export function findByClass(node, className) {
  return findAll(node, (element) => String(element.props?.className ?? '').split(/\s+/).includes(className))[0]
}

export function findByText(node, text) {
  return findAll(node, (element) => textOf(element).includes(text))[0]
}

export function click(element) {
  if (!element || typeof element.props?.onClick !== 'function') throw new Error('element has no onClick')
  return element.props.onClick({ preventDefault() {}, target: element, currentTarget: element })
}

export function change(element, value) {
  if (!element || typeof element.props?.onChange !== 'function') throw new Error('element has no onChange')
  return element.props.onChange({ target: { value }, currentTarget: element })
}
