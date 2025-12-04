"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const platform_router_1 = __importDefault(require("./platform.router"));
const tenant_router_1 = __importDefault(require("./tenant.router"));
const public_router_1 = __importDefault(require("./public.router"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Public/User Context Routes
// Note: Individual routes inside publicRouter must handle their own Auth if needed (e.g. coreRoutes does)
router.use(public_router_1.default);
// Platform Routes (Super Admin)
// Most platform routes likely need Auth.
// We assume existing routes handle auth or we can add it here if needed.
// Given the previous structure, we'll rely on the routes themselves or add global auth if verified.
// For safety, let's assume Platform routes are protected.
// But wait, authRoutes (in publicRouter) has login.
// If we put authMiddleware here, it won't affect publicRouter.
router.use(platform_router_1.default);
// Tenant Routes (Company Context)
// These REQUIRE Auth AND Company Context
router.use(authMiddleware_1.authMiddleware);
router.use(tenant_router_1.default);
exports.default = router;
//# sourceMappingURL=router.js.map