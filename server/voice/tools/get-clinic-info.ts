import { db } from '../../db';
import { ClinicService } from '../../services/clinic.service';
import { AppointmentService } from '../../services/appointment.service';
import { ServiceService } from '../../services/service.service';

export async function getClinicInfo(clinicId: string) {
  const clinic = (await ClinicService.getById(clinicId));
  if (!clinic) {
    return { error: 'Clinic not found' };
  }

  const services = await ServiceService.list(clinicId, { status: 'ACTIVE' });

  return {
    clinic_name: clinic.name,
    address: clinic.address,
    phone: clinic.phone,
    email: clinic.email,
    city: clinic.city,
    timezone: clinic.timezone,
    currency: clinic.currency || 'USD',
    currency_symbol: clinic.currency_symbol || '$',
    operating_hours: clinic.operating_hours,
    status: clinic.status,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      fee: `${clinic.currency_symbol || '$'}${s.fee}`,
    })),
  };
}
