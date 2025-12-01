"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSuperAdmin = void 0;
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
async function assertSuperAdmin(req, res, next) {
    var _a;
    try {
        // Guardrail: only enforce on super-admin routes
        if (!req.originalUrl.includes('/super-admin')) {
            return next();
        }
        // Never block auth self-check endpoints
        if (req.path.startsWith('/auth/me/')) {
            return next();
        }
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const user = await bindRepositories_1.diContainer.userRepository.getUserById(userId);
        if (!user || !user.isAdmin()) {
            return res.status(403).json({ success: false, message: 'Forbidden: SUPER_ADMIN access required' });
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
}
exports.assertSuperAdmin = assertSuperAdmin;
//# sourceMappingURL=assertSuperAdmin.js.map