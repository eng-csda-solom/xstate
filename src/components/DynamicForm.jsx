import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { useFormMachine } from '../hooks/useFormMachine'
import { submitUserAction } from '../api/submitAction'

export function DynamicForm({ action }) {
  const {
    jsonSchema,
    uiSchema,
    context,
    errors,
    isSubmitting,
    isSuccess,
    change,
    submit,
    reset,
    serverError
  } = useFormMachine(action, submitUserAction)

  // RJSF onChange gives { formData }
  const handleChange = ({ formData }) => {
    // Sync each changed field to state machine
    for (const [key, value] of Object.entries(formData)) {
      if (context.form[key] !== value) {
        change(key, value)
      }
    }
  }

  const handleSubmit = () => {
    submit()
  }

  if (isSuccess) {
    return (
      <div className="success-message">
        <h2>✅ Success!</h2>
        <pre>{JSON.stringify(context.result, null, 2)}</pre>
        <button onClick={reset}>Create Another</button>
      </div>
    )
  }

  return (
    <div className="dynamic-form">
      <Form
        schema={jsonSchema}
        uiSchema={uiSchema}
        formData={context.form}
        validator={validator}
        onChange={handleChange}
        onSubmit={handleSubmit}
        // Use machine errors instead of RJSF built-in
        extraErrors={transformErrorsForRJSF(errors)}
        disabled={isSubmitting}
      >
        