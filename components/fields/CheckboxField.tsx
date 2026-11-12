"use client";

import { Checkbox } from "../ui/checkbox";
import { FormControl } from "../ui/form";

// Loaded on demand by CustomFormField so Radix Checkbox isn't in the bundle of pages without one.
const CheckboxField = ({
  field,
  name,
  label,
}: {
  field: any;
  name: string;
  label?: string;
}) => (
  <FormControl>
    <div className="flex items-center gap-4">
      <Checkbox
        id={name}
        checked={field.value}
        onCheckedChange={field.onChange}
      />
      <label htmlFor={name} className="checkbox-label">
        {label}
      </label>
    </div>
  </FormControl>
);

export default CheckboxField;
