
/**
 * HrDTOs.ts
 */
import { Employee } from '../../domain/hr/entities/Employee';

export interface EmployeeDTO {
  id: string;
  name: string;
  position?: string;
  email?: string;
  active: boolean;
}

export class HrDTOMapper {
  static toEmployeeDTO(emp: Employee): EmployeeDTO {
    return {
      id: emp.id,
      name: emp.name,
      position: emp.position,
      email: emp.email,
      active: emp.active,
    };
  }
}
