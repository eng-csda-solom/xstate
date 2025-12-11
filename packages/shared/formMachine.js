/**
 * Shared XState machine definition + schema generator
 * Used by both frontend and backend
 */

// ---------- Schema Generator (action.formJson -> JSON Schema) ----------
function formJsonToJsonSchema(formJson, title = 'Form') {
  const schema = {
    type: 'object',
    properties: {},
    required: []
  }

  for (const field of formJson) {
    const prop = {}
    
    switch (field.type) {
      case 'string':
      case 'text':
      case 'textarea':
        prop.type = 'string'
        if (field.minLength) prop.minLength = field.minLength
        if (field.maxLength) prop.maxLength = field.maxLength
        if (field.pattern) prop.pattern = field.pattern
        break
      case 'email':
        prop.type = 'string'
        prop.format = 'email'
        break
      case 'number':
      case 'integer': 
        prop.type = field.type
        if (field.minimum !== undefined) prop.minimum = field.minimum
        if (field.maximum !== undefined) prop.maximum = field.maximum
        break
      case 'select':
        prop.type = 'string'
        prop.enum = field.options.map(o => o.value)
        prop.oneOf = field.options.map(o => ({ const: o.value, title: o.label }))
        break
      case 'boolean':
        prop.type = 'boolean'
        break
      case 'date':
        prop.type = 'string'
        prop.format = 'date'
        break
      default:
        prop.type = 'string'
    }

    if (field.default !== undefined) prop.default = field. default
    if (field.label) prop.title = field.label
    if (field.description) prop.description = field.description

    schema.properties[field.name] = prop
    if (field.required) schema.required.push(field.name)
  }

  return schema
}

// ---------- UI Schema for JSON Forms ----------
function formJsonToUiSchema(formJson) {
  const elements = formJson.map(field => {
    const element = {
      type: 'Control',
      scope: `#/properties/${field.name}`
    }

    // JSON Forms options
    if (field.placeholder) {
      element.options = { placeholder: field.placeholder }
    }
    if (field.type === 'textarea') {
      element.options = { ...element.options, multi: true }
    }

    return element
  })

  return {
    type: 'VerticalLayout',
    elements
  }
}

// ---------- Machine Definition (serializable) ----------
const formMachineDefinition = {
  id: 'dynamicForm',
  initial: 'idle',
  context: {
    formId: null,
    formData: {},
    errors: {},
    serverErrors: {},
    isSubmitting: false,
    result: null
  },
  states: {
    idle: {
      on: {
        INIT: {
          target: 'editing',
          actions:  ['initForm']
        }
      }
    },
    editing:  {
      on:  {
        CHANGE: {
          actions: ['updateField', 'clearFieldError']
        },
        SUBMIT:  {
          target:  'validating'
        }
      }
    },
    validating: {
      always: [
        { target: 'submitting', cond: 'isValid' },
        { target: 'editing' }
      ]
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
          target:  'error',
          actions: ['setServerErrors', 'clearSubmitting']
        }
      }
    },
    success:  {
      on: {
        RESET: { target: 'idle', actions: ['resetForm'] }
      }
    },
    error:  {
      on:  {
        CHANGE: {
          target: 'editing',
          actions:  ['updateField', 'clearFieldError']
        },
        RETRY: { target: 'validating' }
      }
    }
  }
}

module.exports = {
  formMachineDefinition,
  formJsonToJsonSchema,
  formJsonToUiSchema
}