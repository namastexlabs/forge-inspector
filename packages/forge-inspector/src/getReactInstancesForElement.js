/**
 * @typedef {import('react-reconciler').Fiber} Fiber
 */

import { getReactInstanceForElement } from './getReactInstanceForElement.js'

export function getReactInstancesForElement(
  /** @type {HTMLElement} */
  element
) {
  /** @type {Set<Fiber>} */
  const instances = new Set()
  let instance = getReactInstanceForElement(element)

  while (instance) {
    instances.add(instance)

    // Try _debugOwner first (React 16.8-18), then fall back to return (React 19+)
    // _debugOwner points to the logical owner (component that rendered this)
    // return points to the parent Fiber node (structural parent)
    instance = instance._debugOwner || instance.return
  }

  return Array.from(instances)
}
