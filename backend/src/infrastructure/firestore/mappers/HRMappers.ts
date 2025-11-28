
import * as admin from 'firebase-admin';
import { Employee } from '../../../domain/hr/entities/Employee';
import { AttendanceRecord } from '../../../domain/hr/entities/AttendanceRecord';

export class EmployeeMapper {
  static toDomain(data: any): Employee {
    return new Employee(
      data.id,
      data.companyId,
      data.name,
      data.phone,
      data.departmentId,
      data.active,
      data.position,
      data.email
    );
  }
  static toPersistence(entity: Employee): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      name: entity.name,
      phone: entity.phone,
      departmentId: entity.departmentId,
      active: entity.active,
      position: entity.position || null,
      email: entity.email || null
    };
  }
}

export class AttendanceMapper {
  static toDomain(data: any): AttendanceRecord {
    return new AttendanceRecord(
      data.id,
      data.employeeId,
      data.companyId,
      data.loginAt?.toDate?.() || new Date(data.loginAt),
      data.method,
      data.logoutAt ? (data.logoutAt?.toDate?.() || new Date(data.logoutAt)) : undefined,
      data.location
    );
  }
  static toPersistence(entity: AttendanceRecord): any {
    return {
      id: entity.id,
      employeeId: entity.employeeId,
      companyId: entity.companyId,
      loginAt: admin.firestore.Timestamp.fromDate(entity.loginAt),
      method: entity.method,
      logoutAt: entity.logoutAt ? admin.firestore.Timestamp.fromDate(entity.logoutAt) : null,
      location: entity.location || null
    };
  }
}
