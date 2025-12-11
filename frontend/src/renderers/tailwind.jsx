import React from 'react'
import { withJsonFormsControlProps } from '@jsonforms/react'
import { rankWith, isStringControl, isBooleanControl, isIntegerControl, isNumberControl, isEnumControl } from '@jsonforms/core'

// ---------- Text Input Renderer ----------
const TextInputRenderer = ({ data, handleChange, path, label, errors, schema, enabled }) => {
  const hasError = errors && errors. length > 0
  const placeholder = schema. description || ''

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {schema.minLength && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={schema.format === 'email' ? 'email' : 'text'}
        value={data || ''}
        onChange={(e) => handleChange(path, e.target.value)}
        disabled={!enabled}
        placeholder={placeholder}
        className={`
          w-full px-3 py-2 border rounded-lg shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
        `}
      />
      {hasError && <p className="mt-1 text-sm text-red-600">{errors}</p>}
    </div>
  )
}

// ---------- Number Input Renderer ----------
const NumberInputRenderer = ({ data, handleChange, path, label, errors, schema, enabled }) => {
  const hasError = errors && errors.length > 0

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={data ??  ''}
        onChange={(e) => handleChange(path, e.target.value === '' ? undefined : Number(e.target. value))}
        disabled={!enabled}
        min={schema.minimum}
        max={schema.maximum}
        className={`
          w-full px-3 py-2 border rounded-lg shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus: ring-indigo-500 focus:border-indigo-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${hasError ? 'border-red-500' : 'border-gray-300'}
        `}
      />
      {hasError && <p className="mt-1 text-sm text-red-600">{errors}</p>}
    </div>
  )
}

// ---------- Select Renderer ----------
const SelectRenderer = ({ data, handleChange, path, label, errors, schema, enabled }) => {
  const hasError = errors && errors.length > 0
  const options = schema.oneOf || schema.enum?. map((v) => ({ const: v, title: v })) || []

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={data || ''}
        onChange={(e) => handleChange(path, e. target.value)}
        disabled={!enabled}
        className={`
          w-full px-3 py-2 border rounded-lg shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${hasError ? 'border-red-500' : 'border-gray-300'}
        `}
      >
        <option value="">Select... </option>
        {options.map((opt) => (
          <option key={opt.const} value={opt.const}>
            {opt.title}
          </option>
        ))}
      </select>
      {hasError && <p className="mt-1 text-sm text-red-600">{errors}</p>}
    </div>
  )
}

// ---------- Checkbox Renderer ----------
const CheckboxRenderer = ({ data, handleChange, path, label, enabled }) => {
  return (
    <div className="mb-4">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={data || false}
          onChange={(e) => handleChange(path, e. target.checked)}
          disabled={!enabled}
          className="
            w-5 h-5 rounded border-gray-300 text-indigo-600
            focus:ring-indigo-500 focus:ring-2
            disabled:opacity-50 disabled: cursor-not-allowed
          "
        />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </label>
    </div>
  )
}

// ---------- Textarea Renderer ----------
const TextareaRenderer = ({ data, handleChange, path, label, errors, schema, enabled, uischema }) => {
  const hasError = errors && errors. length > 0
  const isMulti = uischema?. options?.multi

  if (! isMulti) return null // fall back to default

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={data || ''}
        onChange={(e) => handleChange(path, e.target.value)}
        disabled={! enabled}
        rows={4}
        maxLength={schema.maxLength}
        className={`
          w-full px-3 py-2 border rounded-lg shadow-sm transition-colors resize-y
          focus:outline-none focus:ring-2 focus: ring-indigo-500 focus:border-indigo-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${hasError ? 'border-red-500' : 'border-gray-300'}
        `}
      />
      {schema.maxLength && (
        <p className="mt-1 text-xs text-gray-500 text-right">
          {(data || '').length} / {schema.maxLength}
        </p>
      )}
      {hasError && <p className="mt-1 text-sm text-red-600">{errors}</p>}
    </div>
  )
}

// Wrap with JSON Forms HOC
const TailwindTextInput = withJsonFormsControlProps(TextInputRenderer)
const TailwindNumberInput = withJsonFormsControlProps(NumberInputRenderer)
const TailwindSelect = withJsonFormsControlProps(SelectRenderer)
const TailwindCheckbox = withJsonFormsControlProps(CheckboxRenderer)
const TailwindTextarea = withJsonFormsControlProps(TextareaRenderer)

// ---------- Renderer Registry ----------
export const tailwindRenderers = [
  // Textarea (higher priority for multi-line strings)
  {
    tester: rankWith(5, (uischema, schema) => {
      return uischema?.options?. multi && schema?. type === 'string'
    }),
    renderer: TailwindTextarea
  },
  // Enum / Select
  { tester: rankWith(4, isEnumControl), renderer: TailwindSelect },
  // Boolean
  { tester: rankWith(3, isBooleanControl), renderer: TailwindCheckbox },
  // Integer / Number
  { tester: rankWith(2, isIntegerControl), renderer: TailwindNumberInput },
  { tester: rankWith(2, isNumberControl), renderer: TailwindNumberInput },
  // String (fallback)
  { tester: rankWith(1, isStringControl), renderer: TailwindTextInput }
]

export const tailwindCells = tailwindRenderers // reuse for cells