
import { AttendanceRecord } from '../../../domain/hr/entities/AttendanceRecord';

/**
 * Interface for Attendance logs.
 */
export interface IAttendanceRepository {
  logAttendance(record: AttendanceRecord): Promise<void>;
  closeAttendance(recordId: string, logoutAt: Date): Promise<void>;
  getEmployeeAttendance(employeeId: string): Promise<AttendanceRecord[]>;
}
