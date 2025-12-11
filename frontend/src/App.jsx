import React, { useEffect, useState } from 'react'
import { JsonForms } from '@jsonforms/react'
import {
  vanillaCells,
  vanillaRenderers
} from '@jsonforms/vanilla-renderers'
import { useMachine } from '@xstate/react'
import { createMachine, assign } from 'xstate'

// Custom TailwindCSS renderers (we'll create these)
import { tailwindRenderers, tailwindCells } from './renderers/tailwind'

// ---------- Client-side Machine ----------
const createFormMachine = (actionId) =>
  createMachine(
    {
      id: 'clientForm',
      initial: 'loading',
      context:  {
        actionId,
        jsonSchema: null,
        uiSchema: null,
        formData: {},
        errors: {},
        serverErrors: {},
        isSubmitting:  false,
        result: null
      },
      states: {
        loading: {
          invoke: {
            src: 'loadSchema',
            onDone: {
              target: 'editing',
              actions:  ['setSchemas']
            },
            onError: {
              target: 'error',
              actions: ['setLoadError']
            }
          }
        },
        editing: {
          on: {
            CHANGE: { actions: ['updateFormData'] },
            SUBMIT: { target: 'submitting' }
          }
        },
        submitting: {
          entry: ['setSubmitting'],
          invoke: {
            src: 'submitForm',
            onDone: {
              target: 'success',
              actions: ['setResult', 'clearSubmitting']
            },
            onError:  {
              target:  'editing',
              actions:  ['setServerErrors', 'clearSubmitting']
            }
          }
        },
        success: {
          on: {
            RESET: { target:  'editing', actions: ['resetForm'] },
            NEW:  { target: 'loading' }
          }
        },
        error: {
          on: { RETRY: 'loading' }
        }
      }
    },
    {
      actions: {
        setSchemas: assign((ctx, ev) => ({
          jsonSchema: ev.data.jsonSchema,
          uiSchema:  ev.data.uiSchema,
          formData:  {} // reset
        })),
        updateFormData: assign((ctx, ev) => ({
          formData: ev.data,
          errors: ev.errors || {}
        })),
        setSubmitting:  assign({ isSubmitting: true }),
        clearSubmitting: assign({ isSubmitting: false }),
        setResult: assign((ctx, ev) => ({ result: ev.data. data })),
        setServerErrors: assign((ctx, ev) => ({
          serverErrors: ev.data?. errors || { _form: 'Submission failed' }
        })),
        setLoadError: assign((ctx, ev) => ({
          serverErrors: { _form: ev. data?.message || 'Failed to load form' }
        })),
        resetForm: assign({
          formData: {},
          errors: {},
          serverErrors: {},
          result: null
        })
      },
      services: {
        loadSchema: async (ctx) => {
          const res = await fetch(`http://localhost:3001/api/actions/${ctx.actionId}/schema`)
          if (!res.ok) throw new Error('Failed to load schema')
          return res.json()
        },
        submitForm: async (ctx) => {
          const res = await fetch(`http://localhost:3001/api/actions/${ctx.actionId}/submit`, {
            method: 'POST',
            headers:  { 'Content-Type': 'application/json' },
            body: JSON. stringify(ctx.formData)
          })
          const data = await res. json()
          if (!res.ok || !data.success) {
            throw data
          }
          return data
        }
      }
    }
  )

// ---------- Main App ----------
export default function App() {
  const [actions, setActions] = useState([])
  const [selectedAction, setSelectedAction] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/actions')
      .then((r) => r.json())
      .then(setActions)
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">Dynamic Forms</h1>
          <p className="text-gray-600 mt-1">XState + JSON Forms + Fastify + TailwindCSS</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4">
        {/* Action Selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select an action:
          </label>
          <div className="flex gap-3">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => setSelectedAction(action. id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedAction === action.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        {selectedAction && <DynamicForm key={selectedAction} actionId={selectedAction} />}
      </main>
    </div>
  )
}

// ---------- Dynamic Form Component ----------
function DynamicForm({ actionId }) {
  const [state, send] = useMachine(() => createFormMachine(actionId))
  const { jsonSchema, uiSchema, formData, errors, serverErrors, isSubmitting, result } = state. context

  const handleChange = ({ data, errors }) => {
    send({ type: 'CHANGE', data, errors })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    send({ type: 'SUBMIT' })
  }

  // Loading state
  if (state.matches('loading')) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading form...</p>
      </div>
    )
  }

  // Error state
  if (state.matches('error')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-medium">Error loading form</h3>
        <p className="text-red-600 mt-1">{serverErrors._form}</p>
        <button
          onClick={() => send({ type: 'RETRY' })}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  // Success state
  if (state.matches('success')) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h3 className="text-green-800 font-medium text-lg">Success!</h3>
        </div>
        <pre className="mt-4 bg-green-100 rounded p-4 text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
        <button
          onClick={() => send({ type: 'RESET' })}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Create Another
        </button>
      </div>
    )
  }

  // Editing state
  return (
    <div className="bg-white rounded-lg shadow">
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          {/* Server errors banner */}
          {serverErrors._form && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{serverErrors._form}</p>
            </div>
          )}

          {/* JSON Forms */}
          <JsonForms
            schema={jsonSchema}
            uischema={uiSchema}
            data={formData}
            renderers={tailwindRenderers}
            cells={tailwindCells}
            onChange={handleChange}
          />
        </div>

        {/* Submit button */}
        <div className="px-6 py-4 bg-gray-50 border-t rounded-b-lg">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-colors ${
              isSubmitting
                ? 'bg-indigo-400 cursor-not-allowed'
                :  'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </form>

      {/* Debug panel (optional) */}
      <details className="border-t">
        <summary className="px-6 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
          Debug:  Machine State
        </summary>
        <pre className="px-6 py-4 bg-gray-900 text-green-400 text-xs overflow-auto">
          {JSON.stringify({ state: state.value, context: state.context }, null, 2)}
        </pre>
      </details>
    </div>
  )
}