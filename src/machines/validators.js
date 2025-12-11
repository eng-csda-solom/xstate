import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, messages: true })
addFormats(ajv) // adds 'email', 'uri', 'date', etc.

/**
 * Validate form values against formJson spec using AJV. 
 * Returns an object:  { fieldName: 'error message', ...  }
 */
export function validateWithAJV(formValues, formJson) {
  // Convert formJson to JSON Schema on the fly (or cache it)
  const schema = formJsonToValidationSchema(formJson)
  const validate = ajv.compile(schema)
  const valid = validate(formValues)

  if (valid) return {}

  // Map AJV errors to { fieldName: message }
  const errors = {}
  for (const err of validate.errors || []) {
    // err.instancePath is like '/username'
    const field = err.instancePath.replace(/^\//, '') || err.params?. missingProperty
    if (field && ! errors[field]) {
      errors[field] = formatErrorMessage(err, formJson)
    }
  }
  return errors
}

function formJsonToValidationSchema(formJson) {
  const properties = {}
  const required = []

  for (const f of formJson) {
    const prop = { title: f.label }

    switch (f.type) {
      case 'string':
      case 'email':
      case 'password':
        prop. type = 'string'
        if (f.format) prop.format = f. format
        if (f.minLength) prop.minLength = f.minLength
        if (f.maxLength) prop.maxLength = f.maxLength
        if (f.pattern) prop.pattern = f.pattern
        break
      case 'number':
      case 'integer': 
        prop.type = f.type
        if (f.minimum !== undefined) prop.minimum = f.minimum
        if (f. maximum !== undefined) prop.maximum = f. maximum
        break
      case 'select':
        prop. type = 'string'
        prop.enum = f. options. map((o) => o.value)
        break
      case 'boolean':
        prop. type = 'boolean'
        break
      default:
        prop.type = 'string'
    }

    properties[f.name] = prop
    if (f.required) required.push(f.name)
  }

  return { type: 'object', properties, required }
}

function formatErrorMessage(err, formJson) {
  const fieldDef = formJson. find(
    (f) => f.name === err.instancePath.replace(/^\//, '')
  )
  const label = fieldDef?. label || err.instancePath

  switch (err.keyword) {
    case 'required': 
      return `${err.params.missingProperty} is required`
    case 'minLength':
      return `${label} must have at least ${err. params.limit} characters`
    case 'format':
      return `${label} must be a valid ${err.params.format}`
    case 'minimum':
      return `${label} must be ≥ ${err. params.limit}`
    case 'maximum':
      return `${label} must be ≤ ${err.params.limit}`
    case 'enum': 
      return `${label} must be one of the allowed values`
    default:
      return err.message || 'Invalid value'
  }
}