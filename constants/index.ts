export const GenderOptions = ["male", "female", "other"];

export const PatientFormDefaultValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  birthDate: new Date(Date.now()),
  gender: "male" as Gender,
  address: "",
  occupation: "",
  emergencyContactName: "",
  emergencyContactNumber: "",
  primaryPhysician: "",
  insuranceProvider: "",
  insurancePolicyNumber: "",
  allergies: "",
  currentMedication: "",
  familyMedicalHistory: "",
  pastMedicalHistory: "",
  identificationType: "Birth Certificate",
  identificationNumber: "",
  identificationDocument: [],
  treatmentConsent: false,
  disclosureConsent: false,
  privacyConsent: false,
};

export const IdentificationTypes = [
  "Birth Certificate",
  "Driver's License",
  "Medical Insurance Card/Policy",
  "Military ID Card",
  "National Identity Card",
  "Passport",
  "Resident Alien Card (Green Card)",
  "Social Security Card",
  "State ID Card",
  "Student ID Card",
  "Voter ID Card",
] as const;

// Names are stored without the "Dr." prefix; the UI and SMS messages add it.
export const Doctors = [
  { name: "Naresh Trehan" },
  { name: "Devi Prasad Shetty" },
  { name: "Ashok Seth" },
  { name: "D. Nageshwar Reddy" },
  { name: "Suresh H. Advani" },
  { name: "Arvinder Singh Soin" },
  { name: "Subhash Gupta" },
  { name: "Sandeep Vaishya" },
  { name: "Atul Goel" },
  { name: "Randeep Guleria" },
  { name: "Ambrish Mithal" },
  { name: "Jose Chacko Periappuram" },
];

export const StatusIcon = {
  scheduled: "/assets/icons/check.svg",
  pending: "/assets/icons/pending.svg",
  cancelled: "/assets/icons/cancelled.svg",
};
