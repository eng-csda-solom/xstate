import { createMachine, assign } from 'xstate'
import { validateWithAJV } from './validators'

/**
 * Factory that creates a form machine for any action. 
 * @param {Object} action - The action definition with formJson
 * @param {Function} submitFn - Real async function to call on submit
 */
export function createFormMachine(action, submitFn) {
  const initialForm = buildInitialValues(action. formJson)

  return createMachine(
    {
      id: `form. ${action.id}`,
      initial: 'idle',
      context:  {
        form:  initialForm,
        errors: {},
        submitting: false,
        result: null,
        serverError: null
      },
      states: {
        idle: {
          on: {
            OPEN: 'editing',
            // Support pre-filling for edit scenarios
            PREFILL: {
              target: 'editing',
              actions: ['prefillForm']
            }
          }
        },
        editing:  {
          entry: ['clearServerError'],
          on: {
            CHANGE: { actions: ['assignField', 'clearFieldError'] },
            SUBMIT: { target: 'validating', actions: ['runValidation'] },
            RESET:  { target: 'idle', actions: ['resetForm'] }
          }
        },
        validating: {
          always: [
            { cond: 'isValid', target: 'submitting' },
            { target: 'editing' }
          ]
        },
        submitting: {
          entry: ['markSubmitting'],
          invoke: {
            id: 'submitService',
            src: 'callSubmitFn',
            onDone: {
              target: 'success',
              actions:  ['assignResult', 'clearSubmitting']
            },
            onError:  {
              target:  'editing',
              actions:  ['assignServerError', 'clearSubmitting']
            }
          }
        },
        success:  {
          on: {
            OPEN: { target: 'editing', actions: ['resetForm'] },
            CLOSE: 'idle'
          }
        }
      }
    },
    {
      actions: {
        assignField: assign((ctx, ev) => ({
          form: { ...ctx.form, [ev.name]:  ev.value }
        })),
        clearFieldError:  assign((ctx, ev) => {
          const next = { ...ctx. errors }
          delete next[ev.name]
          return { errors: next }
        }),
        runValidation: assign((ctx) => ({
          errors: validateWithAJV(ctx.form, action.formJson)
        })),
        prefillForm: assign((ctx, ev) => ({
          form:  { ...ctx.form, ... ev.data }
        })),
        resetForm: assign(() => ({
          form: initialForm,
          errors: {},
          result: null,
          serverError: null
        })),
        markSubmitting: assign({ submitting: true }),
        clearSubmitting: assign({ submitting: false }),
        assignResult:  assign((ctx, ev) => ({ result: ev.data })),
        assignServerError: assign((ctx, ev) => ({
          serverError: ev.data?. message || 'Submission failed'
        })),
        clearServerError: assign({ serverError: null })
      },
      guards: {
        isValid: (ctx) => Object.keys(ctx. errors).length === 0
      },
      services: {
        // Wire the real submit function here
        callSubmitFn:  (ctx) => submitFn(ctx.form)
      }
    }
  )
}

function buildInitialValues(formJson) {
  const values = {}
  for (const field of formJson) {
    if (field.default !== undefined) {
      values[field. name] = field. default
    } else {
      values[field.name] = field.type === 'boolean' ? false : ''
    }
  }
  return values
}