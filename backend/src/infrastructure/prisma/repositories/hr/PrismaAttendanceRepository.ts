import { PrismaClient } from '@prisma/client';
import { IAttendanceRepository } from '../../../../repository/interfaces/hr/IAttendanceRepository';
import { AttendanceRecord, AttendanceMethod } from '../../../../domain/hr/entities/AttendanceRecord';

export class PrismaAttendanceRepository implements IAttendanceRepository {
  constructor(private prisma: PrismaClient) {}

  async logAttendance(record: AttendanceRecord): Promise<void> {
    await this.prisma.attendance.create({
      data: {
        id: record.id,
        employeeId: record.employeeId,
        companyId: record.companyId,
        loginAt: record.loginAt,
        method: record.method,
        location: record.location,
        date: record.loginAt,
      },
    });
  }

  async closeAttendance(recordId: string, logoutAt: Date): Promise<void> {
    await this.prisma.attendance.update({
      where: { id: recordId },
      data: { logoutAt },
    });
  }

  async getEmployeeAttendance(employeeId: string): Promise<AttendanceRecord[]> {
    const records = await this.prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { loginAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): AttendanceRecord {
    return new AttendanceRecord(
      record.id,
      record.employeeId,
      record.companyId,
      record.loginAt,
      record.method as AttendanceMethod,
      record.logoutAt ?? undefined,
      record.location ?? undefined
    );
  }
}
