/* eslint-disable no-unused-vars */
import { E164Number } from "libphonenumber-js/core";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Control } from "react-hook-form";
import PhoneInput from "react-phone-number-input";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

// Heavier field types are code-split: each page only downloads the ones it renders
// (e.g. the home page form never loads react-datepicker or Radix Select).
// They're still server-rendered, so there's no layout shift.
const DatePickerField = dynamic(() => import("./fields/DatePickerField"));
const SelectField = dynamic(() => import("./fields/SelectField"));
const CheckboxField = dynamic(() => import("./fields/CheckboxField"));

// Enums in TypeScript are used to define a set of NAMED CONSTANTS. They allow you to associate friendly names with a set of constant values, which makes the code more readable and easier to maintain.
export enum FormFieldType {
  INPUT = "input",
  TEXTAREA = "textarea",
  PHONE_INPUT = "phoneInput",
  CHECKBOX = "checkbox",
  DATE_PICKER = "datePicker",
  SELECT = "select",
  SKELETON = "skeleton",
}

interface CustomProps {
  control: Control<any>;
  name: string;
  label?: string;
  placeholder?: string;
  iconSrc?: string;
  iconAlt?: string;
  disabled?: boolean;
  dateFormat?: string;
  showTimeSelect?: boolean;
  children?: React.ReactNode;
  renderSkeleton?: (field: any) => React.ReactNode;
  fieldType: FormFieldType;
}

const RenderInput = ({ field, props }: { field: any; props: CustomProps }) => {
  switch (props.fieldType) {
    case FormFieldType.INPUT:
      return (
        <div className="flex rounded-md border border-dark-500 bg-dark-400">
          {props.iconSrc && (
            <Image
              src={props.iconSrc}
              height={24}
              width={24}
              alt={props.iconAlt ?? ""}
              className="ml-2"
            />
          )}
          <FormControl>
            <Input
              placeholder={props.placeholder}
              {...field}
              className="shad-input border-0"
            />
          </FormControl>
        </div>
      );
    case FormFieldType.TEXTAREA:
      return (
        <FormControl>
          <Textarea
            placeholder={props.placeholder}
            {...field}
            className="shad-textArea"
            disabled={props.disabled}
          />
        </FormControl>
      );
    case FormFieldType.PHONE_INPUT:
      return (
        //for phone_input we use a library from npm by searching react-phone-number-input. Remember: Do not re-invent the wheel.
        <FormControl>
          <PhoneInput
            defaultCountry="US"
            placeholder={props.placeholder}
            international
            withCountryCallingCode
            value={field.value as E164Number | undefined}
            onChange={field.onChange}
            className="input-phone"
          />
        </FormControl>
      );
    case FormFieldType.CHECKBOX:
      return (
        <CheckboxField field={field} name={props.name} label={props.label} />
      );
    case FormFieldType.DATE_PICKER:
      return (
        <DatePickerField
          field={field}
          dateFormat={props.dateFormat}
          showTimeSelect={props.showTimeSelect}
        />
      );
    case FormFieldType.SELECT:
      return (
        <SelectField field={field} placeholder={props.placeholder}>
          {props.children}
        </SelectField>
      );
    case FormFieldType.SKELETON:
      return props.renderSkeleton ? props.renderSkeleton(field) : null;
    default:
      return null;
  }
};

const CustomFormField = (props: CustomProps) => {
  const { control, name, label } = props;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex-1">
          {props.fieldType !== FormFieldType.CHECKBOX && label && (
            <FormLabel className="shad-input-label">{label}</FormLabel>
          )}
          <RenderInput field={field} props={props} />

          <FormMessage className="shad-error" />
        </FormItem>
      )}
    />
  );
};

export default CustomFormField;
