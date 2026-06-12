import { Control, Controller, FieldValues, Path } from 'react-hook-form'

interface SelectFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    options: ReadonlyArray<{ value: string; label: string }>;
}

const SelectField = <T extends FieldValues>({ control, name, label, options }: SelectFieldProps<T>) => (
    <Controller
        name={name}
        control={control}
        render={({ field, fieldState }) => (
            <div className="flex flex-col gap-2">
                <label htmlFor={String(name)} className="field-label">{label}</label>
                <select id={String(name)} className="field-input appearance-none" {...field}>
                    {options.map((option) => (
                        <option key={option.value} value={option.value} className="bg-ink-900">
                            {option.label}
                        </option>
                    ))}
                </select>
                {fieldState.error && (
                    <p className="text-sm text-alert-400">{fieldState.error.message}</p>
                )}
            </div>
        )}
    />
)

export default SelectField
