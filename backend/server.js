const Fastify = require('fastify')
const cors = require('@fastify/cors')
const websocket = require('@fastify/websocket')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')
const { createMachine, interpret, assign } = require('xstate')
const {
  formMachineDefinition,
  formJsonToJsonSchema,
  formJsonToUiSchema
} = require('../packages/shared/formMachine')

const fastify = Fastify({ logger: true })
const ajv = new Ajv({ allErrors: true, verbose: true })
addFormats(ajv)

// ---------- Action Registry (your dynamic forms) ----------
const actions = {
  createUser: {
    id: 'createUser',
    label: 'Create User',
    formJson: [
      { name: 'username', type: 'string', label: 'Username', required: true, minLength: 3 },
      { name: 'email', type: 'email', label: 'Email', required:  true },
      { name: 'role', type: 'select', label: 'Role', required:  true, options: [
        { value:  'user', label: 'User' },
        { value: 'admin', label: 'Admin' }
      ], default: 'user' },
      { name: 'age', type: 'integer', label: 'Age', minimum: 18, maximum: 120 },
      { name:  'bio', type: 'textarea', label: 'Bio', maxLength: 500 }
    ],
    // Server-side handler
    handler: async (data) => {
      // Simulate DB insert
      await new Promise(r => setTimeout(r, 500))
      return { id: `user_${Date.now()}`, ...data, createdAt: new Date().toISOString() }
    }
  },
  createOrder: {
    id: 'createOrder',
    label:  'Create Order',
    formJson:  [
      { name: 'productId', type: 'string', label:  'Product ID', required: true },
      { name: 'quantity', type:  'integer', label: 'Quantity', required: true, minimum:  1 },
      { name: 'priority', type: 'select', label: 'Priority', options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' }
      ], default:  'normal' },
      { name: 'expressShipping', type: 'boolean', label:  'Express Shipping', default: false }
    ],
    handler: async (data) => {
      await new Promise(r => setTimeout(r, 300))
      return { orderId: `order_${Date.now()}`, ...data }
    }
  }
}

// Precompile validators
const validators = {}
for (const [key, action] of Object.entries(actions)) {
  const schema = formJsonToJsonSchema(action.formJson, action.label)
  validators[key] = ajv.compile(schema)
}

// ---------- Register Plugins ----------
async function start() {
  await fastify.register(cors, { origin: true })
  await fastify.register(websocket)

  // ---------- REST Endpoints ----------

  // GET /api/actions - List available actions
  fastify.get('/api/actions', async () => {
    return Object.values(actions).map(a => ({
      id: a.id,
      label: a.label
    }))
  })

  // GET /api/actions/: id/schema - Get JSON Schema + UI Schema for an action
  fastify.get('/api/actions/:id/schema', async (req, reply) => {
    const action = actions[req.params.id]
    if (!action) {
      return reply.status(404).send({ error: 'Action not found' })
    }

    return {
      jsonSchema: formJsonToJsonSchema(action.formJson, action.label),
      uiSchema: formJsonToUiSchema(action.formJson),
      formJson: action.formJson // raw definition if needed
    }
  })

  // POST /api/actions/:id/validate - Validate form data
  fastify.post('/api/actions/:id/validate', async (req, reply) => {
    const validator = validators[req.params.id]
    if (!validator) {
      return reply.status(404).send({ error: 'Action not found' })
    }

    const valid = validator(req.body)
    if (valid) {
      return { valid: true, errors: null }
    }

    // Transform AJV errors to field-keyed map
    const errors = {}
    for (const err of validator.errors) {
      const field = err.instancePath.replace('/', '') || err.params.missingProperty
      errors[field] = err.message
    }
    return { valid: false, errors }
  })

  // POST /api/actions/:id/submit - Validate + Execute action
  fastify.post('/api/actions/:id/submit', async (req, reply) => {
    const action = actions[req.params.id]
    const validator = validators[req.params.id]
    if (!action || !validator) {
      return reply.status(404).send({ error: 'Action not found' })
    }

    // Validate
    const valid = validator(req.body)
    if (!valid) {
      const errors = {}
      for (const err of validator.errors) {
        const field = err.instancePath.replace('/', '') || err.params.missingProperty
        errors[field] = err.message
      }
      return reply.status(400).send({ success: false, errors })
    }

    // Execute handler
    try {
      const result = await action.handler(req.body)
      return { success: true, data: result }
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ---------- WebSocket:  Real-time state sync (optional) ----------
  fastify.register(async function (fastify) {
    fastify.get('/ws/form/:actionId', { websocket: true }, (socket, req) => {
      const action = actions[req.params.actionId]
      if (!action) {
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Action not found' }))
        socket.close()
        return
      }

      // Create an XState interpreter for this session
      const machine = createMachine(
        {
          ...formMachineDefinition,
          context: {
            ...formMachineDefinition.context,
            formId: action.id
          }
        },
        {
          actions: {
            initForm: assign((ctx, ev) => ({
              formData: ev.initialData || {}
            })),
            updateField: assign((ctx, ev) => ({
              formData: { ...ctx.formData, [ev.field]: ev.value }
            })),
            clearFieldError: assign((ctx, ev) => {
              const next = { ...ctx.errors }
              delete next[ev.field]
              return { errors: next }
            }),
            setSubmitting: assign({ isSubmitting: true }),
            clearSubmitting: assign({ isSubmitting: false }),
            setResult: assign((ctx, ev) => ({ result: ev.data })),
            setServerErrors: assign((ctx, ev) => ({
              serverErrors: ev.data?.errors || { _form: ev.data?.message || 'Unknown error' }
            })),
            resetForm: assign({
              formData: {},
              errors: {},
              serverErrors: {},
              result: null
            })
          },
          guards: {
            isValid: (ctx) => {
              const validator = validators[ctx.formId]
              const valid = validator(ctx.formData)
              if (!valid) {
                // side-effect: store errors (not ideal but works for demo)
                ctx.errors = {}
                for (const err of validator.errors) {
                  const field = err.instancePath.replace('/', '') || err.params.missingProperty
                  ctx.errors[field] = err.message
                }
              }
              return valid
            }
          },
          services: {
            submitForm: async (ctx) => {
              return action.handler(ctx.formData)
            }
          }
        }
      )

      const service = interpret(machine)

      // Send state to client on every transition
      service.onTransition((state) => {
        socket.send(JSON.stringify({
          type: 'STATE',
          state: state.value,
          context: state.context
        }))
      })

      service.start()

      // Handle incoming events from client
      socket.on('message', (msg) => {
        try {
          const event = JSON.parse(msg.toString())
          service.send(event)
        } catch (e) {
          fastify.log.error('Invalid WS message', e)
        }
      })

      socket.on('close', () => {
        service.stop()
      })
    })
  })

  // Start server
  await fastify.listen({ port: 3001, host: '0.0.0.0' })
  console.log('Fastify server running on http://localhost:3001')
}

start().catch(console.error)