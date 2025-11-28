
import { Employee } from '../../../domain/hr/entities/Employee';
import { IEmployeeRepository } from '../../../repository/interfaces/hr';

export class RegisterEmployeeUseCase {
  constructor(private repo: IEmployeeRepository) {}

  async execute(data: any): Promise<Employee> {
    const emp = new Employee(
      `emp_${Date.now()}`,
      data.companyId,
      data.name,
      data.phone,
      data.departmentId,
      true,
      data.position,
      data.email
    );
    await this.repo.createEmployee(emp);
    return emp;
  }
}

export class UpdateEmployeeUseCase {
  constructor(private repo: IEmployeeRepository) {}
  async execute(id: string, data: Partial<Employee>): Promise<void> {
    await this.repo.updateEmployee(id, data);
  }
}
