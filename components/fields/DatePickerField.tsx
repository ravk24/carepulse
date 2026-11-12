"use client";

import Image from "next/image";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { FormControl } from "../ui/form";

// Loaded on demand by CustomFormField so react-datepicker (and its CSS)
// only download on forms that actually have a date field.
const DatePickerField = ({
  field,
  dateFormat,
  showTimeSelect,
}: {
  field: any;
  dateFormat?: string;
  showTimeSelect?: boolean;
}) => (
  <div className="flex rounded-md border border-dark-500 bg-dark-400">
    <Image
      src="/assets/icons/calendar.svg"
      height={24}
      width={24}
      alt=""
      className="ml-2"
    />
    <FormControl>
      <ReactDatePicker
        showTimeSelect={showTimeSelect ?? false}
        selected={field.value}
        onChange={(date: Date) => field.onChange(date)}
        timeInputLabel="Time:"
        dateFormat={dateFormat ?? "MM/dd/yyyy"}
        wrapperClassName="date-picker"
      />
    </FormControl>
  </div>
);

export default DatePickerField;
