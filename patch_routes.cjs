const fs = require('fs');

let code = fs.readFileSync('server/routes/clinic.routes.ts', 'utf-8');

// Add import
const importStmt = "import { AppointmentService } from '../services/appointment.service';\n";
if (!code.includes("import { AppointmentService }")) {
  code = importStmt + code;
}

// 1. Replace POST /appointments
code = code.replace(
  /clinicRouter\.post\(\s*'\/appointments',\s*requireClinicPermission\('manage_appointments'\),\s*\(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?return res\.status\(201\)\.json\(\{ appointment: result\.appointment \}\);\s*\}\s*\);/,
`clinicRouter.post(
  '/appointments',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const { patient_id, doctor_id, service_id, date, start_time, notes } = req.body;

    const result = await AppointmentService.book(clinicId, {
      patientId: patient_id,
      doctorId: doctor_id,
      serviceId: service_id,
      date,
      startTime: start_time,
      notes
    }, {
      type: 'HUMAN_RECEPTIONIST',
      userId: req.user!.id,
      name: req.user!.name
    });

    if (!result.success) {
      const status = result.error_code === 'SLOT_NO_LONGER_AVAILABLE' || result.error_code === 'VALIDATION_ERROR' ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.status(201).json({ appointment: result.appointment });
  }
);`
);

// 2. Replace PUT /appointments/:id/status
code = code.replace(
  /clinicRouter\.put\(\s*'\/appointments\/:id\/status',\s*requireClinicPermission\('manage_appointments'\),\s*\(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?return res\.json\(\{ appointment: result\.appointment \}\);\s*\}\s*\);/,
`clinicRouter.put(
  '/appointments/:id/status',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const appointmentId = req.params.id;
    const { status, notes } = req.body;

    const result = await AppointmentService.updateStatus(clinicId, appointmentId, {
      status,
      notes: notes !== undefined ? notes : undefined
    }, {
      type: 'HUMAN_RECEPTIONIST',
      userId: req.user!.id,
      name: req.user!.name
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ appointment: result.appointment });
  }
);`
);

// 3. Replace POST /appointments/:id/reschedule
code = code.replace(
  /clinicRouter\.post\(\s*'\/appointments\/:id\/reschedule',\s*requireClinicPermission\('manage_appointments'\),\s*\(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?return res\.json\(\{ appointment: result\.appointment \}\);\s*\}\s*\);/,
`clinicRouter.post(
  '/appointments/:id/reschedule',
  requireClinicPermission('manage_appointments'),
  async (req: AuthenticatedRequest, res: Response) => {
    const clinicId = getAuthClinicId(req);
    const appointmentId = req.params.id;
    const { newDate, newStartTime, reason } = req.body;

    const result = await AppointmentService.reschedule(clinicId, appointmentId, {
      newDate,
      newStartTime,
      reason
    }, {
      type: 'HUMAN_RECEPTIONIST',
      userId: req.user!.id,
      name: req.user!.name
    });

    if (!result.success) {
      const status = result.error_code === 'SLOT_NO_LONGER_AVAILABLE' || result.error_code === 'VALIDATION_ERROR' ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }

    return res.json({ appointment: result.appointment });
  }
);`
);

fs.writeFileSync('server/routes/clinic.routes.ts', code);
console.log("Routes patched");
