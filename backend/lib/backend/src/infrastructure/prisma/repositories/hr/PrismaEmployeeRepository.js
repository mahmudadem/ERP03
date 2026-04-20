"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaEmployeeRepository = void 0;
const Employee_1 = require("../../../../domain/hr/entities/Employee");
class PrismaEmployeeRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createEmployee(employee) {
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
    async updateEmployee(id, data) {
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.phone !== undefined)
            updateData.phone = data.phone;
        if (data.departmentId !== undefined) {
            updateData.departmentId = data.departmentId;
            updateData.department = data.departmentId;
        }
        if (data.position !== undefined)
            updateData.position = data.position;
        if (data.email !== undefined)
            updateData.email = data.email;
        if (data.active !== undefined)
            updateData.active = data.active;
        await this.prisma.employee.update({
            where: { id },
            data: updateData,
        });
    }
    async getEmployee(id) {
        const record = await this.prisma.employee.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyEmployees(companyId) {
        const records = await this.prisma.employee.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a, _b, _c, _d;
        return new Employee_1.Employee(record.id, record.companyId, record.name, (_a = record.phone) !== null && _a !== void 0 ? _a : '', (_b = record.departmentId) !== null && _b !== void 0 ? _b : '', record.active, (_c = record.position) !== null && _c !== void 0 ? _c : undefined, (_d = record.email) !== null && _d !== void 0 ? _d : undefined);
    }
}
exports.PrismaEmployeeRepository = PrismaEmployeeRepository;
//# sourceMappingURL=PrismaEmployeeRepository.js.map