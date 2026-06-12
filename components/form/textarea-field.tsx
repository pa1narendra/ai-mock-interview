"use client"

import { Control, Controller, FieldValues, Path } from 'react-hook-form'

interface TextareaFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    placeholder?: string;
    rows?: number;
}

const TextareaField = <T extends FieldValues>({ control, name, label, placeholder, rows = 8 }: TextareaFieldProps<T>) => (
    <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
            <div className="flex flex-col gap-2">
                <label htmlFor={String(name)} className="field-label">{label}</label>
                <textarea
                    id={String(name)}
                    className="field-input resize-y min-h-28"
                    placeholder={placeholder}
                    rows={rows}
                    {...field}
                />
                {fieldState.error && (
                    <p className="text-sm text-alert-400">{fieldState.error.message}</p>
                )}
            </div>
        )}
    />
)

export default TextareaField
