import { PrismaClient } from '@prisma/client';
import { IEmployeeRepository } from '../../../../repository/interfaces/hr/IEmployeeRepository';
import { Employee } from '../../../../domain/hr/entities/Employee';

export class PrismaEmployeeRepository implements IEmployeeRepository {
  constructor(private prisma: PrismaClient) {}

  async createEmployee(employee: Employee): Promise<void> {
    await this.prisma.employee.create({
      data: {
        id: employee.id,
        companyId: employee.companyId,
        code: employee.id,
        name: employee.name,
        phone: employee.phone,
        departmentId: employee.departmentId,
        department: employee.departmentId,
        position: employee.position,
        email: employee.email,
        active: employee.active,
        hireDate: new Date(),
      },
    });
  }

  async updateEmployee(id: string, data: Partial<Employee>): Promise<void> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.departmentId !== undefined) {
      updateData.departmentId = data.departmentId;
      updateData.department = data.departmentId;
    }
    if (data.position !== undefined) updateData.position = data.position;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.active !== undefined) updateData.active = data.active;

    await this.prisma.employee.update({
      where: { id },
      data: updateData,
    });
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const record = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getCompanyEmployees(companyId: string): Promise<Employee[]> {
    const records = await this.prisma.employee.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): Employee {
    return new Employee(
      record.id,
      record.companyId,
      record.name,
      record.phone ?? '',
      record.departmentId ?? '',
      record.active,
      record.position ?? undefined,
      record.email ?? undefined
    );
  }
}
