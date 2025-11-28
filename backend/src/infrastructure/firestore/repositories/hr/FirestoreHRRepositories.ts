
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IEmployeeRepository, IAttendanceRepository } from '../../../../repository/interfaces/hr';
import { Employee } from '../../../../domain/hr/entities/Employee';
import { AttendanceRecord } from '../../../../domain/hr/entities/AttendanceRecord';
import { EmployeeMapper, AttendanceMapper } from '../../mappers/HRMappers';
import * as admin from 'firebase-admin';

export class FirestoreEmployeeRepository extends BaseFirestoreRepository<Employee> implements IEmployeeRepository {
  protected collectionName = 'employees';
  protected toDomain = EmployeeMapper.toDomain;
  protected toPersistence = EmployeeMapper.toPersistence;

  async createEmployee(e: Employee): Promise<void> { return this.save(e); }
  async updateEmployee(id: string, data: Partial<Employee>): Promise<void> { await this.db.collection(this.collectionName).doc(id).update(data); }
  async getEmployee(id: string): Promise<Employee | null> { return this.findById(id); }
  async getCompanyEmployees(companyId: string): Promise<Employee[]> {
      const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestoreAttendanceRepository extends BaseFirestoreRepository<AttendanceRecord> implements IAttendanceRepository {
  protected collectionName = 'attendance';
  protected toDomain = AttendanceMapper.toDomain;
  protected toPersistence = AttendanceMapper.toPersistence;

  async logAttendance(r: AttendanceRecord): Promise<void> { return this.save(r); }
  async closeAttendance(id: string, logoutAt: Date): Promise<void> {
      await this.db.collection(this.collectionName).doc(id).update({ 
          logoutAt: admin.firestore.Timestamp.fromDate(logoutAt) 
      });
  }
  async getEmployeeAttendance(employeeId: string): Promise<AttendanceRecord[]> {
      const snap = await this.db.collection(this.collectionName).where('employeeId', '==', employeeId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}
