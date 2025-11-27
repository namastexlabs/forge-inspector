/**
 * Parent Integration Utilities
 *
 * These utilities help parent applications integrate with forge-inspector's
 * visual agent when it runs in an iframe.
 *
 * @example
 * // React with drop-in component:
 * import { VisualAgentOverlay } from 'forge-inspector/parent-integration'
 *
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       <VisualAgentOverlay onReport={console.log} />
 *     </>
 *   )
 * }
 *
 * @example
 * // React with custom UI:
 * import { useVisualAgentListener } from 'forge-inspector/parent-integration'
 *
 * function CustomVisualAgentUI() {
 *   const { isRecording, observations, report, pendingConfirm, confirmResponse } = useVisualAgentListener()
 *   // Build your own UI
 * }
 *
 * @example
 * // Vanilla JS:
 * import { createVisualAgentListener } from 'forge-inspector/parent-integration'
 *
 * const listener = createVisualAgentListener({
 *   onRecordingStarted: () => console.log('Recording started'),
 *   onRecordingObservation: (obs) => console.log('Observation:', obs),
 *   onQAReport: (report) => console.log('Report:', report),
 *   onConfirmStep: (payload, respond) => {
 *     // Show custom confirmation UI
 *     respond(true, 'User confirmed')
 *   }
 * })
 * listener.start()
 */

export { createVisualAgentListener } from './createVisualAgentListener.js'
export { useVisualAgentListener } from './useVisualAgentListener.js'
export { VisualAgentOverlay } from './VisualAgentOverlay.js'
