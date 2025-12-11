import { useMachine } from '@xstate/react'
import { useMemo } from 'react'
import { createFormMachine } from '../machines/formMachineFactory'
import { buildSchemas } from '../schemas/schemaBuilder'

/**
 * React hook that provides: 
 * - XState machine state & send
 * - JSON Schema + uiSchema for rendering
 * - Helpers for common operations
 */
export function useFormMachine(action, submitFn) {
  // Build machine once per action
  const machine = useMemo(
    () => createFormMachine(action, submitFn),
    [action, submitFn]
  )

  const [state, send] = useMachine(machine)

  // Build schemas for the UI library
  const { jsonSchema, uiSchema } = useMemo(
    () => buildSchemas(action),
    [action]
  )

  return {
    // Machine state
    currentState: state. value,
    context: state.context,
    isSubmitting: state. matches('submitting'),
    isSuccess: state.matches('success'),
    isFailure: state.matches('failure'),
    errors: state.context.errors,

    // Actions
    open: () => send({ type: 'OPEN' }),
    change: (name, value) => send({ type: 'CHANGE', name, value }),
    submit: () => send({ type: 'SUBMIT' }),
    reset: () => send({ type: 'RESET' }),

    // Schemas for UI
    jsonSchema,
    uiSchema,

    // Raw access
    state,
    send
  }
}