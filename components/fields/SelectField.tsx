"use client";

import { FormControl } from "../ui/form";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

// Loaded on demand by CustomFormField so Radix Select isn't in the bundle of pages without a select.
const SelectField = ({
  field,
  placeholder,
  children,
}: {
  field: any;
  placeholder?: string;
  children?: React.ReactNode;
}) => (
  <FormControl>
    <Select onValueChange={field.onChange} defaultValue={field.value}>
      <FormControl>
        <SelectTrigger className="shad-select-trigger">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </FormControl>
      <SelectContent className="shad-select-content">{children}</SelectContent>
    </Select>
  </FormControl>
);

export default SelectField;
