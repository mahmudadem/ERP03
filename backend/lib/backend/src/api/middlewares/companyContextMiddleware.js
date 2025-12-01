"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyContextMiddleware = void 0;
const companyContextMiddleware = (req, res, next) => {
    const user = req.user;
    if (user && user.companyId) {
        req.companyId = user.companyId;
    }
    next();
};
exports.companyContextMiddleware = companyContextMiddleware;
//# sourceMappingURL=companyContextMiddleware.js.map