"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEmployeeUseCase = exports.RegisterEmployeeUseCase = void 0;
const Employee_1 = require("../../../domain/hr/entities/Employee");
class RegisterEmployeeUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const emp = new Employee_1.Employee(`emp_${Date.now()}`, data.companyId, data.name, data.phone, data.departmentId, true, data.position, data.email);
        await this.repo.createEmployee(emp);
        return emp;
    }
}
exports.RegisterEmployeeUseCase = RegisterEmployeeUseCase;
class UpdateEmployeeUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        await this.repo.updateEmployee(id, data);
    }
}
exports.UpdateEmployeeUseCase = UpdateEmployeeUseCase;
//# sourceMappingURL=EmployeeUseCases.js.map