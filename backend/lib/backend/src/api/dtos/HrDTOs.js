"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrDTOMapper = void 0;
class HrDTOMapper {
    static toEmployeeDTO(emp) {
        return {
            id: emp.id,
            name: emp.name,
            position: emp.position,
            email: emp.email,
            active: emp.active,
        };
    }
}
exports.HrDTOMapper = HrDTOMapper;
//# sourceMappingURL=HrDTOs.js.map