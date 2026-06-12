"use client"

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Control, Controller, FieldValues, Path } from 'react-hook-form'
import { cn } from '@/lib/utils'

interface TextFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: Path<T>;
    label: string;
    placeholder?: string;
    type?: "text" | "email" | "password" | "number";
}

const TextField = <T extends FieldValues>({ control, name, label, placeholder, type = "text" }: TextFieldProps<T>) => {
    const [show, setShow] = useState(false)
    const isPassword = type === "password"
    const inputType = isPassword && show ? "text" : type

    return (
        <Controller
            name={name}
            control={control}
            render={({ field, fieldState }) => (
                <div className="flex flex-col gap-2">
                    <label htmlFor={String(name)} className="field-label">{label}</label>
                    <div className="relative">
                        <input
                            id={String(name)}
                            className={cn("field-input", isPassword && "pr-11")}
                            placeholder={placeholder}
                            type={inputType}
                            {...field}
                            value={typeof field.value === "number" && Number.isNaN(field.value) ? "" : field.value ?? ""}
                            onChange={(e) =>
                                field.onChange(
                                    type === "number"
                                        ? e.target.value === "" ? undefined : e.target.valueAsNumber
                                        : e.target.value
                                )
                            }
                        />
                        {isPassword && (
                            <button
                                type="button"
                                tabIndex={-1}
                                aria-label={show ? "Hide password" : "Show password"}
                                onClick={() => setShow((s) => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-mist-500 hover:text-mist-300 transition-colors"
                            >
                                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        )}
                    </div>
                    {fieldState.error && (
                        <p className="text-sm text-alert-400">{fieldState.error.message}</p>
                    )}
                </div>
            )}
        />
    )
}

export default TextField
