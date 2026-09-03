import assert from 'node:assert';
import { ScheduleService } from '../services/schedule.service';
import { LeaveService } from '../services/leave.service';
import { DoctorService } from '../services/doctor.service';
import { AppointmentService } from '../services/appointment.service';
import { getAvailableSlots } from '../voice/tools/get-available-slots';
import { db } from '../db';
import { DoctorSchedule, DoctorLeave } from '../../src/types';

async function runTests() {
  console.log('--- STARTING WAVE 3 SCHEDULES & LEAVES TESTS ---');

  const clinicA = 'clinic_test_w3_a';
  const clinicB = 'clinic_test_w3_b';
  const doctorA1 = 'doc_w3_a1';
  const doctorA2 = 'doc_w3_a2';
  const doctorB1 = 'doc_w3_b1';

  // Seed test clinics
  db.data.clinics = [
    {
      id: clinicA,
      name: 'Clinic Alpha',
      address: '100 Main St',
      phone: '+15551111111',
      email: 'alpha@clinic.test',
      city: 'Metropolis',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      operating_hours: {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '09:00', close: '13:00', closed: false },
        sunday: { open: '09:00', close: '17:00', closed: true },
      },
    },
    {
      id: clinicB,
      name: 'Clinic Beta',
      address: '200 Second St',
      phone: '+15552222222',
      email: 'beta@clinic.test',
      city: 'Gotham',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      operating_hours: {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '09:00', close: '13:00', closed: false },
        sunday: { open: '09:00', close: '17:00', closed: true },
      },
    },
  ];

  // Seed test doctors
  db.data.doctors = [
    {
      id: doctorA1,
      clinic_id: clinicA,
      name: 'Dr. Alice Alpha',
      specialization: 'Cardiology',
      qualification: 'MD',
      phone: '+15551010101',
      email: 'alice@alpha.test',
      consultation_duration_minutes: 30,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: doctorA2,
      clinic_id: clinicA,
      name: 'Dr. Aaron Alpha',
      specialization: 'Pediatrics',
      qualification: 'MD',
      phone: '+15551020202',
      email: 'aaron@alpha.test',
      consultation_duration_minutes: 30,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
    {
      id: doctorB1,
      clinic_id: clinicB,
      name: 'Dr. Bob Beta',
      specialization: 'Dermatology',
      qualification: 'MD',
      phone: '+15552010101',
      email: 'bob@beta.test',
      consultation_duration_minutes: 30,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    },
  ];

  // Seed test service & patient
  db.data.services = [
    {
      id: 'srv_w3_1',
      clinic_id: clinicA,
      name: 'Consultation',
      duration_minutes: 30,
      fee: 100,
      status: 'ACTIVE',
      assigned_doctor_ids: [doctorA1, doctorA2],
    },
  ];

  db.data.patients = [
    {
      id: 'pat_w3_1',
      clinic_id: clinicA,
      name: 'John Patient',
      phone: '+15559998888',
      email: 'john@patient.test',
      preferred_language: 'en',
      created_at: new Date().toISOString(),
    },
  ];

  db.data.doctor_schedules = [];
  db.data.doctor_leaves = [];
  db.data.appointments = [];

  // TEST 1: ScheduleService - save and list
  console.log('[Test 1] ScheduleService.save and getByDoctorAndDay');
  const saveRes = await ScheduleService.save(clinicA, {
    doctor_id: doctorA1,
    day_of_week: 1, // Monday
    start_time: '09:00',
    end_time: '17:00',
    break_start: '13:00',
    break_end: '14:00',
    buffer_minutes: 5,
  });
  assert.strictEqual(saveRes.success, true, 'Schedule save should succeed');
  assert.strictEqual(saveRes.schedule?.clinic_id, clinicA);
  assert.strictEqual(saveRes.schedule?.doctor_id, doctorA1);
  assert.strictEqual(saveRes.schedule?.day_of_week, 1);

  const getSched = await ScheduleService.getByDoctorAndDay(clinicA, doctorA1, 1);
  assert.ok(getSched, 'Should retrieve Monday schedule');
  assert.strictEqual(getSched?.start_time, '09:00');
  assert.strictEqual(getSched?.end_time, '17:00');

  // TEST 2: ScheduleService validation & doctor ownership
  console.log('[Test 2] ScheduleService validation & doctor ownership');
  const invalidDocRes = await ScheduleService.save(clinicA, {
    doctor_id: doctorB1, // Belongs to Clinic B
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
  });
  assert.strictEqual(invalidDocRes.success, false);
  assert.strictEqual(invalidDocRes.error_code, 'DOCTOR_NOT_FOUND');

  const invalidDayRes = await ScheduleService.save(clinicA, {
    doctor_id: doctorA1,
    day_of_week: 9,
    start_time: '09:00',
    end_time: '17:00',
  });
  assert.strictEqual(invalidDayRes.success, false);
  assert.strictEqual(invalidDayRes.error_code, 'VALIDATION_ERROR');

  // TEST 3: Default Mon-Fri schedule creation
  console.log('[Test 3] Default Mon-Fri schedule creation');
  const defaultScheds = await ScheduleService.createDefaultScheduleForDoctor(clinicA, doctorA2);
  assert.strictEqual(defaultScheds.length, 5, 'Should create 5 days');
  assert.deepStrictEqual(defaultScheds.map(s => s.day_of_week), [1, 2, 3, 4, 5]);

  const listA2 = await ScheduleService.list(clinicA, doctorA2);
  assert.strictEqual(listA2.length, 5);

  // TEST 4: ScheduleService delete
  console.log('[Test 4] ScheduleService delete');
  const delSchedRes = await ScheduleService.delete(clinicA, doctorA2, 5); // Delete Friday
  assert.strictEqual(delSchedRes.success, true);
  const checkFri = await ScheduleService.getByDoctorAndDay(clinicA, doctorA2, 5);
  assert.strictEqual(checkFri, null);

  // TEST 5: LeaveService - create and check
  console.log('[Test 5] LeaveService.create and isDoctorOnLeave');
  const createLeaveRes = await LeaveService.create(clinicA, {
    doctor_id: doctorA1,
    start_date: '2026-09-10',
    end_date: '2026-09-12',
    reason: 'Medical Conference',
  });
  assert.strictEqual(createLeaveRes.success, true);
  assert.ok(createLeaveRes.leave);
  assert.strictEqual(createLeaveRes.leave?.doctor_id, doctorA1);

  const checkLeaveActive = await LeaveService.isDoctorOnLeave(clinicA, doctorA1, '2026-09-11');
  assert.strictEqual(checkLeaveActive.onLeave, true);
  assert.strictEqual(checkLeaveActive.leave?.reason, 'Medical Conference');

  const checkLeaveInactive = await LeaveService.isDoctorOnLeave(clinicA, doctorA1, '2026-09-15');
  assert.strictEqual(checkLeaveInactive.onLeave, false);

  // TEST 6: LeaveService date validation & cross-clinic isolation
  console.log('[Test 6] LeaveService validation & cross-clinic isolation');
  const invalidDateRes = await LeaveService.create(clinicA, {
    doctor_id: doctorA1,
    start_date: '2026-09-20',
    end_date: '2026-09-15',
    reason: 'Invalid Dates',
  });
  assert.strictEqual(invalidDateRes.success, false);
  assert.strictEqual(invalidDateRes.error_code, 'INVALID_DATE_RANGE');

  const crossDocLeave = await LeaveService.create(clinicA, {
    doctor_id: doctorB1,
    start_date: '2026-09-20',
    end_date: '2026-09-22',
    reason: 'Cross Clinic Attempt',
  });
  assert.strictEqual(crossDocLeave.success, false);
  assert.strictEqual(crossDocLeave.error_code, 'DOCTOR_NOT_FOUND');

  // TEST 7: Availability with Leaves & Schedules
  console.log('[Test 7] Availability with Leaves & Schedules');
  // Doctor A1 is on leave 2026-09-07 (Monday)
  await LeaveService.create(clinicA, {
    doctor_id: doctorA1,
    start_date: '2026-09-07',
    end_date: '2026-09-07',
    reason: 'Personal Leave',
  });

  const leaveSlotCheck = await getAvailableSlots(clinicA, {
    doctorId: doctorA1,
    date: '2026-09-07',
  });
  assert.strictEqual(leaveSlotCheck.available, false);
  assert.strictEqual((leaveSlotCheck as any).on_leave, true);
  assert.strictEqual(leaveSlotCheck.slots?.length, 0);

  // Next Monday (2026-09-14), Doctor A1 is working and not on leave
  const openSlotCheck = await getAvailableSlots(clinicA, {
    doctorId: doctorA1,
    date: '2026-09-14',
  });
  assert.strictEqual(openSlotCheck.available, true);
  assert.ok(openSlotCheck.slots && openSlotCheck.slots.length > 0);

  // Verify break interval 13:00 - 14:00 is not offered
  const breakOverlaps = openSlotCheck.slots?.filter(
    (s) => s.time >= '13:00' && s.time < '14:00'
  );
  assert.strictEqual(breakOverlaps?.length, 0);

  // TEST 8: Appointment Booking rejected on leave & unscheduled day
  console.log('[Test 8] Appointment Booking rejected on leave & unscheduled day');
  const bookOnLeave = await AppointmentService.book(
    clinicA,
    {
      patientId: 'pat_w3_1',
      doctorId: doctorA1,
      serviceId: 'srv_w3_1',
      date: '2026-09-07', // On leave
      startTime: '10:00',
    },
    { type: 'HUMAN_RECEPTIONIST', userId: 'staff_1', name: 'Staff Member' }
  );
  assert.strictEqual(bookOnLeave.success, false);
  assert.strictEqual(bookOnLeave.error_code, 'VALIDATION_ERROR');
  assert.ok(bookOnLeave.error?.includes('scheduled leave'));

  const bookOnSunday = await AppointmentService.book(
    clinicA,
    {
      patientId: 'pat_w3_1',
      doctorId: doctorA1,
      serviceId: 'srv_w3_1',
      date: '2026-09-13', // Sunday (no schedule)
      startTime: '10:00',
    },
    { type: 'HUMAN_RECEPTIONIST', userId: 'staff_1', name: 'Staff Member' }
  );
  assert.strictEqual(bookOnSunday.success, false);
  assert.strictEqual(bookOnSunday.error_code, 'VALIDATION_ERROR');
  assert.ok(bookOnSunday.error?.includes('working schedule'));

  // TEST 9: Concurrency
  console.log('[Test 9] Concurrency handling');
  const concurrentSchedules = await Promise.all([
    ScheduleService.save(clinicA, {
      doctor_id: doctorA1,
      day_of_week: 2, // Tuesday
      start_time: '08:00',
      end_time: '16:00',
    }),
    ScheduleService.save(clinicA, {
      doctor_id: doctorA1,
      day_of_week: 3, // Wednesday
      start_time: '09:30',
      end_time: '17:30',
    }),
  ]);
  assert.ok(concurrentSchedules.every(r => r.success));

  const tue = await ScheduleService.getByDoctorAndDay(clinicA, doctorA1, 2);
  const wed = await ScheduleService.getByDoctorAndDay(clinicA, doctorA1, 3);
  assert.strictEqual(tue?.start_time, '08:00');
  assert.strictEqual(wed?.start_time, '09:30');

  // TEST 10: Tenant Isolation
  console.log('[Test 10] Tenant Isolation for schedules and leaves');
  await ScheduleService.save(clinicB, {
    doctor_id: doctorB1,
    day_of_week: 1,
    start_time: '10:00',
    end_time: '16:00',
  });
  await LeaveService.create(clinicB, {
    doctor_id: doctorB1,
    start_date: '2026-09-18',
    end_date: '2026-09-19',
    reason: 'Beta Doctor Leave',
  });

  const clinicAScheds = await ScheduleService.list(clinicA);
  assert.strictEqual(clinicAScheds.some(s => s.clinic_id === clinicB), false);

  const clinicALeaves = await LeaveService.list(clinicA);
  assert.strictEqual(clinicALeaves.some(l => l.clinic_id === clinicB), false);

  console.log('✅ ALL WAVE 3 UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ WAVE 3 TEST SUITE FAILED:', err);
  process.exit(1);
});
