"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrController = void 0;
const EmployeeUseCases_1 = require("../../../application/hr/use-cases/EmployeeUseCases");
const AttendanceUseCases_1 = require("../../../application/hr/use-cases/AttendanceUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const HrDTOs_1 = require("../../dtos/HrDTOs");
class HrController {
    static async registerEmployee(req, res, next) {
        try {
            const useCase = new EmployeeUseCases_1.RegisterEmployeeUseCase(bindRepositories_1.diContainer.employeeRepository);
            const employee = await useCase.execute(req.body);
            res.status(201).json({
                success: true,
                data: HrDTOs_1.HrDTOMapper.toEmployeeDTO(employee)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async recordAttendance(req, res, next) {
        try {
            const useCase = new AttendanceUseCases_1.RecordAttendanceUseCase(bindRepositories_1.diContainer.attendanceRepository);
            await useCase.execute(req.body);
            res.status(200).json({ success: true, message: 'Attendance recorded' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.HrController = HrController;
//# sourceMappingURL=HrController.js.map