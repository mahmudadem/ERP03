
import { Employee } from '../../../domain/hr/entities/Employee';
import { AttendanceRecord } from '../../../domain/hr/entities/AttendanceRecord';

/**
 * Interface for Employee data access.
 */
export interface IEmployeeRepository {
  createEmployee(employee: Employee): Promise<void>;
  updateEmployee(id: string, data: Partial<Employee>): Promise<void>;
  getEmployee(id: string): Promise<Employee | null>;
  getCompanyEmployees(companyId: string): Promise<Employee[]>;
}

/**
 * Interface for Attendance logs.
 */
export interface IAttendanceRepository {
  logAttendance(record: AttendanceRecord): Promise<void>;
  closeAttendance(recordId: string, logoutAt: Date): Promise<void>;
  getEmployeeAttendance(employeeId: string): Promise<AttendanceRecord[]>;
}
