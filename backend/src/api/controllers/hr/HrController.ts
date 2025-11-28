
/**
 * HrController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { RegisterEmployeeUseCase } from '../../../application/hr/use-cases/EmployeeUseCases';
import { RecordAttendanceUseCase } from '../../../application/hr/use-cases/AttendanceUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { HrDTOMapper } from '../../dtos/HrDTOs';

export class HrController {
  static async registerEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new RegisterEmployeeUseCase(diContainer.employeeRepository);
      const employee = await useCase.execute((req as any).body);
      
      (res as any).status(201).json({
        success: true,
        data: HrDTOMapper.toEmployeeDTO(employee)
      });
    } catch (error) {
      next(error);
    }
  }

  static async recordAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new RecordAttendanceUseCase(diContainer.attendanceRepository);
      await useCase.execute((req as any).body);
      (res as any).status(200).json({ success: true, message: 'Attendance recorded' });
    } catch (error) {
      next(error);
    }
  }
}
