/* eslint-disable no-unused-vars */

declare type SearchParamProps = {
  //Index signature "[key: string]: string"
  params: { [key: string]: string }; //refer to the bottom notes
  searchParams: { [key: string]: string | string[] | undefined };
};

declare type Gender = "male" | "female" | "other";
declare type Status = "pending" | "scheduled" | "cancelled";

declare interface CreateUserParams {
  name: string;
  email: string;
  phone: string;
}
declare interface User extends CreateUserParams {
  $id: string;
}

declare interface RegisterUserParams extends CreateUserParams {
  userId: string;
  birthDate: Date;
  gender: Gender;
  address: string;
  occupation: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  primaryPhysician: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  allergies: string | undefined;
  currentMedication: string | undefined;
  familyMedicalHistory: string | undefined;
  pastMedicalHistory: string | undefined;
  identificationType: string | undefined;
  identificationNumber: string | undefined;
  identificationDocument: FormData | undefined;
  privacyConsent: boolean;
}

declare type CreateAppointmentParams = {
  userId: string;
  patient: string;
  primaryPhysician: string;
  reason: string;
  schedule: Date;
  status: Status;
  note: string | undefined;
};

declare type UpdateAppointmentParams = {
  appointmentId: string;
  userId: string;
  timeZone: string;
  appointment: Appointment;
  type: string;
};

/* { [key: string]: string }
 This part is the index signature, and it defines the structure of the params object. It means:
 [key: string]: This is the index signature itself. It indicates that the object can have keys of type string. The key here is a placeholder for any valid string that you can use as an object property.
: string: This means that each key in the params object will map to a value of type string.

The line defines an object params where each key is a string, and the value corresponding to each key must also be a string. This is useful when you don't know the exact keys in advance but know that all the keys will be strings and their corresponding values will also be strings (like a collection of URL parameters or query strings).

Here, key is not a specific property name but a placeholder for any property whose name is a string. The object can have any number of string keys, and the values associated with them must be strings.
In TypeScript, the square brackets [] around key: string in this line:

[key: string]: string;
denote an index signature. An index signature is used to describe the type of properties (or keys) in an object where the names of the properties are not known in advance, but their types are consistent.*/
