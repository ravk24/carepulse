"use server";

import { revalidatePath } from "next/cache";
import twilio from "twilio";

import { Appointment } from "@/types/supabase.types";
import { assertAdmin } from "../auth";
import { TABLES, supabase, toDocument } from "../supabase.config";
import { formatDateTime, parseStringify } from "../utils";

// Select an appointment together with its patient (replaces the Appwrite relationship attribute)
const APPOINTMENT_SELECT = "*, patient:patients!patientId(*)";

const toAppointment = (row: any) =>
  row && { ...toDocument(row), patient: toDocument(row.patient) };

//  CREATE APPOINTMENT
export const createAppointment = async ({
  patient,
  ...appointment
}: CreateAppointmentParams) => {
  try {
    const { data: newAppointment, error } = await supabase
      .from(TABLES.appointments)
      .insert({ ...appointment, patientId: patient })
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/admin"); //kind of refresh the path
    return parseStringify(toAppointment(newAppointment));
  } catch (error) {
    console.error("An error occurred while creating a new appointment:", error);
  }
};

//  GET RECENT APPOINTMENTS
export const getRecentAppointmentList = async () => {
  try {
    await assertAdmin();

    const { data, count, error } = await supabase
      .from(TABLES.appointments)
      .select(APPOINTMENT_SELECT, { count: "exact" })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const documents = (data ?? []).map(toAppointment) as Appointment[];

    const initialCounts = {
      scheduledCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
    };

    const counts = documents.reduce((acc, appointment) => {
      switch (appointment.status) {
        case "scheduled":
          acc.scheduledCount++;
          break;
        case "pending":
          acc.pendingCount++;
          break;
        case "cancelled":
          acc.cancelledCount++;
          break;
      }
      return acc;
    }, initialCounts);

    const result = {
      totalCount: count ?? documents.length,
      ...counts,
      documents,
    };

    return parseStringify(result);
  } catch (error) {
    console.error(
      "An error occurred while retrieving the recent appointments:",
      error
    );
  }
};

//  SEND SMS NOTIFICATION
// Supabase has no messaging service (Appwrite Messaging), so SMS goes through Twilio directly.
export const sendSMSNotification = async (userId: string, content: string) => {
  try {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } =
      process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.warn("Twilio is not configured; skipping SMS notification.");
      return;
    }

    const { data: user, error } = await supabase
      .from(TABLES.users)
      .select("phone")
      .eq("id", userId)
      .single();

    if (error) throw error;

    const message = await twilio(
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN
    ).messages.create({
      body: content,
      from: TWILIO_PHONE_NUMBER,
      to: user.phone,
    });

    return parseStringify({ sid: message.sid, status: message.status });
  } catch (error) {
    console.error("An error occurred while sending sms:", error);
  }
};

//  UPDATE APPOINTMENT
export const updateAppointment = async ({
  appointmentId,
  userId,
  timeZone,
  appointment,
  type,
}: UpdateAppointmentParams) => {
  try {
    // Scheduling/cancelling is done from the admin dashboard only
    await assertAdmin();

    const { data: updatedAppointment, error } = await supabase
      .from(TABLES.appointments)
      .update({
        primaryPhysician: appointment.primaryPhysician,
        schedule: appointment.schedule,
        status: appointment.status,
        cancellationReason: appointment.cancellationReason,
      })
      .eq("id", appointmentId)
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) throw error;
    if (!updatedAppointment) throw new Error("Appointment not found");

    const smsMessage = `Greetings from CarePulse. ${type === "schedule" ? `Your appointment is confirmed for ${formatDateTime(appointment.schedule!, timeZone).dateTime} with Dr. ${appointment.primaryPhysician}` : `We regret to inform that your appointment for ${formatDateTime(appointment.schedule!, timeZone).dateTime} is cancelled. Reason:  ${appointment.cancellationReason}`}.`;

    await sendSMSNotification(userId, smsMessage);

    revalidatePath("/admin");
    return parseStringify(toAppointment(updatedAppointment));
  } catch (error) {
    console.error("An error occurred while scheduling an appointment:", error);
  }
};

// GET APPOINTMENT
export const getAppointment = async (appointmentId: string) => {
  try {
    const { data: appointment, error } = await supabase
      .from(TABLES.appointments)
      .select(APPOINTMENT_SELECT)
      .eq("id", appointmentId)
      .single();

    if (error) throw error;
    return parseStringify(toAppointment(appointment));
  } catch (error) {
    console.error("An error occurred while retrieving the appointment:", error);
  }
};
