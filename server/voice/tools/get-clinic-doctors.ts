import { db } from '../../db';
import { DoctorService } from '../../services/doctor.service';
import { ServiceService } from '../../services/service.service';

export async function getClinicDoctors(clinicId: string, specialization?: string) {
  let doctors = await DoctorService.list(clinicId, { status: 'ACTIVE' });

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
  const services = await ServiceService.list(clinicId, { status: 'ACTIVE' });

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
