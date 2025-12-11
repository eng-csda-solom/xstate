/**
 * interpretedFormMachine.js
 *
 * Example XState machine (interpreted) that is wired with:
 * - real assign/guard implementations
 * - a converter from action.formJson -> JSON Schema (for react-jsonschema-form)
 * - a uiSchema mapping (RJSF / Uniforms friendly)
 * - a small runtime test runner that emits events and collects context snapshots
 *
 * NOTE:
 * - This file is self-contained (no external deps). For production validation you should
 *   use a robust validator (AJV) and real widgets for UI frameworks.
 *
 * Usage:
 *   const { action, createFormMachine, buildSchemas, runExampleSequence } = require('./interpretedFormMachine')
 *   const machine = createFormMachine(action)
 *   const { jsonSchema, uiSchema } = buildSchemas(action)
 *   runExampleSequence() // prints example runtime trace and returns snapshots
 */

const { createMachine, interpret, assign } = require('xstate')

/* --------------------------
   Example "action" with formJson
   (replace with your real action.formJson)
   -------------------------- */
const action = {
  id: 'createUser',
  label: 'Create User',
  formJson: [
    {
      name: 'username',
      type: 'string',
      label: 'Username',
      required: true,
      minLength: 3,
      placeholder: 'Choose a username'
    },
    {
      name: 'email',
      type: 'string',
      format: 'email',
      label: 'Email',
      required: true,
      placeholder: 'you@example.com'
    },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      required: true,
      options: [
        { value: 'user', label: 'User' },
        { value: 'admin', label: 'Admin' }
      ],
      default: 'user'
    },
    {
      name: 'age',
      type: 'number',
      label: 'Age',
      minimum: 0,
      maximum: 120,
      required: false
    },
    {
      name: 'subscribe',
      type: 'boolean',
      label: 'Subscribe to newsletter',
      default: false
    }
  ]
}

/* --------------------------
   Utilities: convert action.formJson -> JSON Schema + uiSchema
   - Produces a JSON Schema and a RJSF uiSchema
   - The same JSON Schema can be used by Uniforms via a JSONSchemaBridge
   -------------------------- */
function formJsonToJsonSchema(formJson) {
  const schema = {
    title: action.label || 'Form',
    type: 'object',
    properties: {},
    required: []
  }
  const uiSchema = {}

  for (const field of formJson) {
    const {
      name,
      type,
      label,
      required,
      minLength,
      maximum,
      minimum,
      format,
      options,
      default: def,
      placeholder
    } = field

    let prop = {}
    switch (type) {
      case 'string':
      case 'email':
      case 'password':
      case 'textarea':
        prop.type = 'string'
        if (format) prop.format = format
        if (minLength) prop.minLength = minLength
        if (def !== undefined) prop.default = def
        break
      case 'number':
      case 'integer':
        prop.type = 'number'
        if (minimum !== undefined) prop.minimum = minimum
        if (maximum !== undefined) prop.maximum = maximum
        if (def !== undefined) prop.default = def
        break
      case 'select':
      case 'radio':
        prop.type = 'string'
        prop.enum = options ? options.map((o) => o.value) : []
        if (def !== undefined) prop.default = def
        break
      case 'boolean':
        prop.type = 'boolean'
        if (def !== undefined) prop.default = !!def
        break
      default:
        // fallback to string
        prop.type = 'string'
        if (def !== undefined) prop.default = def
    }

    // human label
    if (label) prop.title = label

    schema.properties[name] = prop
    if (required) schema.required.push(name)

    // uiSchema hints for RJSF
    uiSchema[name] = {}
    if (type === 'password') uiSchema[name]['ui:widget'] = 'password'
    if (type === 'textarea') uiSchema[name]['ui:widget'] = 'textarea'
    if (placeholder) uiSchema[name]['ui:placeholder'] = placeholder
    if (type === 'select' && options) {
      // provide enumOptions used by react-jsonschema-form
      uiSchema[name]['ui:options'] = {
        enumOptions: options
      }
    }
  }

  return { jsonSchema: schema, uiSchema }
}

/* --------------------------
   Local validator based on action.formJson rules
   (simple; for production use AJV)
   Returns a map: { fieldName: 'error message', ... }
   -------------------------- */
function validateFormValues(formValues, formJson) {
  const errors = {}

  for (const field of formJson) {
    const {
      name,
      label,
      required,
      minLength,
      maximum,
      minimum,
      format,
      type
    } = field
    const value = formValues[name]

    if (required) {
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')
      if (missing) {
        errors[name] = `${label || name} is required`
        continue
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      if (type === 'number' || type === 'integer') {
        const num = Number(value)
        if (Number.isNaN(num)) {
          errors[name] = `${label || name} must be a number`
          continue
        }
        if (minimum !== undefined && num < minimum) {
          errors[name] = `${label || name} must be ≥ ${minimum}`
        }
        if (maximum !== undefined && num > maximum) {
          errors[name] = `${label || name} must be ≤ ${maximum}`
        }
      } else {
        if (minLength !== undefined && String(value).length < minLength) {
          errors[name] = `${label || name} must have at least ${minLength} characters`
        }
        if (format === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(String(value))) {
            errors[name] = `${label || name} must be a valid email`
          }
        }
      }
    }
  }

  return errors
}

/* --------------------------
   XState machine factory wired to the action
   - guards, assigns, and a mock submitting service
   -------------------------- */
function createFormMachine(action) {
  // initial form values
  const initialForm = {}
  for (const f of action.formJson) {
    if (f.default !== undefined) initialForm[f.name] = f.default
    else initialForm[f.name] = f.type === 'boolean' ? false : f.type === 'number' ? null : ''
  }

  const machine = createMachine(
    {
      id: `form.${action.id || 'action'}`,
      initial: 'idle',
      context: {
        form: initialForm,
        errors: {},
        submitting: false,
        result: null,
        lastErrorMessage: null
      },
      states: {
        idle: {
          on: {
            OPEN: 'editing'
          }
        },
        editing: {
          entry: ['clearResult'],
          on: {
            CHANGE: {
              actions: ['assignField', 'clearFieldError']
            },
            SUBMIT: [
              {
                target: 'validating',
                actions: ['validateAssign']
              }
            ]
          }
        },
        validating: {
          always: [
            {
              cond: 'noErrors',
              target: 'submitting',
              actions: ['markSubmitting']
            },
            { target: 'editing' } // errors exist -> back to editing (errors already assigned)
          ]
        },
        submitting: {
          invoke: {
            id: 'submitService',
            src: 'mockSubmit',
            onDone: {
              target: 'success',
              actions: ['assignResult', 'clearSubmitting']
            },
            onError: {
              target: 'failure',
              actions: ['assignSubmitError', 'clearSubmitting']
            }
          }
        },
        success: {
          on: {
            OPEN: 'editing'
          }
        },
        failure: {
          on: {
            CHANGE: {
              actions: ['assignField', 'clearFieldError']
            },
            SUBMIT: [
              {
                target: 'validating',
                actions: ['validateAssign']
              }
            ]
          }
        }
      }
    },
    {
      actions: {
        // assign a single field: event = { type: 'CHANGE', name, value }
        assignField: assign((ctx, ev) => {
          if (!ev || !ev.name) return {}
          return {
            form: {
              ...ctx.form,
              [ev.name]: ev.value
            }
          }
        }),
        // clear single field error on change
        clearFieldError: assign((ctx, ev) => {
          if (!ev || !ev.name) return {}
          const nextErrors = { ...ctx.errors }
          delete nextErrors[ev.name]
          return { errors: nextErrors }
        }),
        // run validation and store errors in context
        validateAssign: assign((ctx) => {
          const errs = validateFormValues(ctx.form, action.formJson)
          return { errors: errs }
        }),
        // mark submitting flag true
        markSubmitting: assign({ submitting: (ctx) => true }),
        // clear submitting flag
        clearSubmitting: assign({ submitting: (ctx) => false }),
        // when submit succeeds
        assignResult: assign((ctx, ev) => {
          return { result: ev.data, lastErrorMessage: null }
        }),
        // when submit fails
        assignSubmitError: assign((ctx, ev) => {
          return { lastErrorMessage: ev.data && ev.data.message ? ev.data.message : String(ev.data) }
        }),
        clearResult: assign({ result: (ctx) => null, lastErrorMessage: (ctx) => null })
      },
      guards: {
        noErrors: (ctx) => {
          return Object.keys(ctx.errors || {}).length === 0
        }
      },
      services: {
        // a mock submit that resolves after a short delay
        mockSubmit: (ctx, ev) =>
          new Promise((resolve, reject) => {
            // Simulate server validation:
            setTimeout(() => {
              if (String(ctx.form.username || '').toLowerCase() === 'fail') {
                reject({ message: 'Server rejected username "fail"' })
              } else {
                resolve({
                  id: 'mock-123',
                  createdAt: new Date().toISOString(),
                  payload: ctx.form
                })
              }
            }, 250)
          })
      }
    }
  )

  return machine
}

/* --------------------------
   Helper that runs a concrete runtime sequence and collects context snapshots
   - Demonstrates events and context after each step for the example action
   -------------------------- */
async function runExampleSequence() {
  const machine = createFormMachine(action)
  const service = interpret(machine).start()

  const snapshots = []

  function pushSnapshot(label) {
    snapshots.push({
      label,
      state: service.state.value,
      context: JSON.parse(JSON.stringify(service.state.context))
    })
  }

  // OPEN form
  service.send({ type: 'OPEN' })
  pushSnapshot('opened form (OPEN)')

  // User types username (valid)
  service.send({ type: 'CHANGE', name: 'username', value: 'jsmith' })
  pushSnapshot('after username change')

  // User types an invalid email first
  service.send({ type: 'CHANGE', name: 'email', value: 'bad-email' })
  pushSnapshot('after invalid email change')

  // User corrects email
  service.send({ type: 'CHANGE', name: 'email', value: 'jsmith@example.com' })
  pushSnapshot('after corrected email change')

  // Set role (select)
  service.send({ type: 'CHANGE', name: 'role', value: 'admin' })
  pushSnapshot('after role change')

  // Set age
  service.send({ type: 'CHANGE', name: 'age', value: 30 })
  pushSnapshot('after age change')

  // Toggle subscribe
  service.send({ type: 'CHANGE', name: 'subscribe', value: true })
  pushSnapshot('after subscribe change')

  // Submit the form
  service.send({ type: 'SUBMIT' })
  pushSnapshot('after SUBMIT (validating/submitting)')

  // wait for terminal (success or failure)
  await new Promise((resolve) => {
    const stop = service.onTransition((s) => {
      if (s.matches('success') || s.matches('failure')) {
        pushSnapshot(`end: ${s.value}`)
        stop()
        resolve()
      }
    })
  })

  service.stop()
  return snapshots
}

/* --------------------------
   Exported helpers & demonstration
   -------------------------- */
const { jsonSchema, uiSchema } = formJsonToJsonSchema(action.formJson)

module.exports = {
  action,
  buildSchemas: (a = action) => {
    // allow passing a different action; returns mapping produced from that action
    return formJsonToJsonSchema(a.formJson)
  },
  createFormMachine,
  runExampleSequence,
  // convenience exports
  jsonSchema,
  uiSchema
}

/* If this module is run directly (node interpretedFormMachine.js),
   execute the example run and print results synchronously */
if (require.main === module) {
  ;(async () => {
    console.log('--- Generated JSON Schema (react-jsonschema-form / Uniforms compatible) ---')
    console.log(JSON.stringify(jsonSchema, null, 2))
    console.log('--- Generated uiSchema (RJSF) ---')
    console.log(JSON.stringify(uiSchema, null, 2))

    console.log('\n--- Running example runtime sequence ---')
    const snaps = await runExampleSequence()
    for (const s of snaps) {
      console.log(`\n--- ${s.label} ---`)
      console.log('state:', s.state)
      console.log('context:', JSON.stringify(s.context, null, 2))
    }
  })()
}