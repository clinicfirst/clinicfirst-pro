import { db } from '../../db';

export async function getClinicDoctors(clinicId: string, specialization?: string) {
  let doctors = db.getDoctors(clinicId).filter((d) => d.status === 'ACTIVE');

  if (specialization) {
    const spec = specialization.toLowerCase();
    doctors = doctors.filter((d) => d.specialization.toLowerCase().includes(spec));
  }

  return {
    doctors: doctors.map((d) => ({
      doctor_id: d.id,
      name: d.name,
      specialization: d.specialization,
      qualification: d.qualification,
      consultation_duration_minutes: d.consultation_duration_minutes,
    })),
  };
}

export async function getClinicServices(clinicId: string) {
  const services = db.getServices(clinicId).filter((s) => s.status === 'ACTIVE');

  return {
    services: services.map((s) => ({
      service_id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      fee: s.fee,
      assigned_doctor_ids: s.assigned_doctor_ids || [],
    })),
  };
}
