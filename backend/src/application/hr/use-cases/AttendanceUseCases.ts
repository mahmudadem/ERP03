
import { AttendanceRecord, AttendanceMethod } from '../../../domain/hr/entities/AttendanceRecord';
import { IAttendanceRepository } from '../../../repository/interfaces/hr';

export class RecordAttendanceUseCase {
  constructor(private repo: IAttendanceRepository) {}

  async execute(data: { employeeId: string; companyId: string; method: AttendanceMethod; location?: string }): Promise<void> {
    const record = new AttendanceRecord(
      `att_${Date.now()}`,
      data.employeeId,
      data.companyId,
      new Date(),
      data.method,
      undefined,
      data.location
    );
    await this.repo.logAttendance(record);
  }
}

export class CloseAttendanceRecordUseCase {
  constructor(private repo: IAttendanceRepository) {}

  async execute(recordId: string): Promise<void> {
    await this.repo.closeAttendance(recordId, new Date());
  }
}
