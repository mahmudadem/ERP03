
import { Employee } from '../../../domain/hr/entities/Employee';

/**
 * Interface for Employee data access.
 */
export interface IEmployeeRepository {
  createEmployee(employee: Employee): Promise<void>;
  updateEmployee(id: string, data: Partial<Employee>): Promise<void>;
  getEmployee(id: string): Promise<Employee | null>;
  getCompanyEmployees(companyId: string): Promise<Employee[]>;
}
