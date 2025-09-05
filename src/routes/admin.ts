import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { checkPermission } from '../middlewares/checkPermissions';
import { adminUsersController } from '../controllers/admin/usersController';
import { adminRidesController } from '../controllers/admin/ridesController';
import { adminChatController } from '../controllers/admin/chatController';
import { adminPrivacyController } from '../controllers/admin/privacyController';
import { adminSecurityController } from '../controllers/admin/securityController';
import { adminReportsController } from '../controllers/admin/reportsController';
import * as userValidators from '../middlewares/validators/admin/users';
import * as rideValidators from '../middlewares/validators/admin/rides';
import * as chatValidators from '../middlewares/validators/admin/chat';
import * as privacyValidators from '../middlewares/validators/admin/privacy';
import * as securityValidators from '../middlewares/validators/admin/security';
import { dateRangeValidator, singleDateValidator } from '../middlewares/validators/admin/reports';
import checkUserRoles from 'middlewares/checkUserRoles';
import { UserRole } from 'types/enums/enums';
import { requestValidator } from 'middlewares/requestValidator';

const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(checkUserRoles([UserRole.Admin]));
adminRouter.use(checkPermission('painel:acesso'));
adminRouter.use(requestValidator);

// --- Rotas de Usuários ---
adminRouter.get('/users', checkPermission('usuarios:ler'), requestValidator, adminUsersController.listUsers);
adminRouter.patch('/users/:targetUserId/status', checkPermission('usuarios:suspender'), userValidators.updateUserStatusValidator, requestValidator, adminUsersController.updateUserStatus);
adminRouter.patch('/users/:targetUserId', checkPermission('usuarios:editar'), userValidators.updateUserValidator, requestValidator, adminUsersController.updateUser);
adminRouter.post('/users/:targetUserId/promote', checkPermission('usuarios:admin:promover'), userValidators.promoteAdminValidator, requestValidator, adminUsersController.promoteToAdmin);
adminRouter.post('/users/:targetUserId/demote', checkPermission('usuarios:admin:rebaixar'), userValidators.demoteAdminValidator, requestValidator, adminUsersController.demoteAdmin);
adminRouter.get('/users/:targetUserId/permissions', checkPermission('usuarios:admin:ver_permissao'), requestValidator, adminUsersController.getAdminPermissions);
adminRouter.put('/users/:targetUserId/permissions', checkPermission('usuarios:admin:editar_permissao'), userValidators.permissionsValidator, requestValidator, adminUsersController.updateAdminPermissions);

// --- Rotas de Caronas ---
adminRouter.get('/rides', checkPermission('caronas:listar'), requestValidator, adminRidesController.listRides);
adminRouter.get('/rides/:id', checkPermission('caronas:detalhes'), requestValidator, adminRidesController.getRideDetails);
adminRouter.put('/rides/:id', checkPermission('caronas:editar'), rideValidators.adminEditRideValidator, requestValidator, adminRidesController.updateRide);
adminRouter.delete('/rides/:id', checkPermission('caronas:cancelar'), rideValidators.adminCancelRideValidator, requestValidator, adminRidesController.cancelRide);
adminRouter.post('/rides/:id/publish', checkPermission('caronas:forcar_publicacao'), rideValidators.adminForcePublishValidator, requestValidator, adminRidesController.forcePublishRide);

// --- Rotas de Chat ---
adminRouter.get('/chats/:rideId/:user1Id/:user2Id', checkPermission('chat:ler'), chatValidators.readChatValidator, requestValidator, adminChatController.getChatHistoryForAdmin);
adminRouter.patch('/chats/messages/:messageId/moderate', checkPermission('chat:moderar'), chatValidators.moderateMessageValidator, requestValidator, adminChatController.moderateMessage);
adminRouter.post('/chats/:rideId/:user1Id/:user2Id/export', checkPermission('chat:exportar_logs'), chatValidators.exportChatValidator, requestValidator, adminChatController.exportChatLogs);

// --- Rotas de Privacidade ---
adminRouter.post('/privacy/reports/:targetUserId', checkPermission('privacidade:emitir_relatorio'), privacyValidators.privacyActionValidator, requestValidator, adminPrivacyController.generateDataReport);
adminRouter.post('/privacy/removal/:targetUserId', checkPermission('privacidade:solicitacao_remocao'), privacyValidators.privacyActionValidator, requestValidator, adminPrivacyController.processRemovalRequest);
adminRouter.get('/privacy/logs/:targetUserId', checkPermission('privacidade:ver_logs'), requestValidator, adminPrivacyController.viewPrivacyLogs);

// --- Rotas de Segurança ---
adminRouter.get('/security/blocks', checkPermission('seguranca:ver_bloqueios'), requestValidator, adminSecurityController.viewBlocks);
adminRouter.post('/security/blocks/:blockId/details', checkPermission('seguranca:ver_motivos'), securityValidators.blockDetailsValidator, requestValidator, adminSecurityController.viewBlockReason);
adminRouter.post('/security/logout/:targetUserId', checkPermission('seguranca:forcar_logout'), securityValidators.forceLogoutValidator, requestValidator, adminSecurityController.forceLogout);

adminRouter.get('/reports/registrations', dateRangeValidator, checkPermission('relatorios:usuarios:cadastro'), requestValidator, adminReportsController.getRegistrationReport);
adminRouter.get('/reports/engagement', singleDateValidator, checkPermission('relatorios:usuarios:engajamento'), requestValidator, adminReportsController.getEngagementReport);
adminRouter.get('/reports/user-blocks', dateRangeValidator, checkPermission('relatorios:usuarios:bloqueios'), requestValidator, adminReportsController.getUserBlocksReport);

// --- Relatórios de Veículos ---
adminRouter.get('/reports/vehicle-inventory', dateRangeValidator, checkPermission('relatorios:veiculos:inventario'), requestValidator, adminReportsController.getVehicleInventoryReport);
// adminRouter.get('/reports/vehicle-conflicts', dateRangeValidator, checkPermission('relatorios:veiculos:conflitos'), requestValidator, adminReportsController.getVehicleConflictReport);

// --- Relatórios de Caronas ---
adminRouter.get('/reports/ride-offers', dateRangeValidator, checkPermission('relatorios:caronas:ofertas'), requestValidator, adminReportsController.getRideOfferReport);
adminRouter.get('/reports/ride-alterations', dateRangeValidator, checkPermission('relatorios:caronas:alteracoes'), requestValidator, adminReportsController.getRideAlterationReport);
adminRouter.get('/reports/ride-bookings', dateRangeValidator, checkPermission('relatorios:caronas:reservas'), requestValidator, adminReportsController.getRideBookingReport);
adminRouter.get('/reports/ride-occupancy', dateRangeValidator, checkPermission('relatorios:caronas:lotacao'), requestValidator, adminReportsController.getRideOccupancyReport);

// --- Relatórios de Geografia ---
adminRouter.get('/reports/geo-adherence', dateRangeValidator, checkPermission('relatorios:geografia:aderencia'), requestValidator, adminReportsController.getGeoAdherenceReport);
adminRouter.get('/reports/geo-performance', dateRangeValidator, checkPermission('relatorios:geografia:desempenho'), requestValidator, adminReportsController.getGeoPerformanceReport);

// --- Relatórios de Chat ---
adminRouter.get('/reports/chat-usage', dateRangeValidator, checkPermission('relatorios:chat:uso'), requestValidator, adminReportsController.getChatUsageReport);
// adminRouter.get('/reports/chat-presence', dateRangeValidator, checkPermission('relatorios:chat:presenca_online'), requestValidator, adminReportsController.getChatPresenceReport);
adminRouter.get('/reports/chat-administration', dateRangeValidator, checkPermission('relatorios:chat:administracao'), requestValidator, adminReportsController.getChatAdminReport);
adminRouter.get('/reports/chat-moderation', dateRangeValidator, checkPermission('relatorios:chat:moderacao'), requestValidator, adminReportsController.getChatModerationReport);

// --- Relatórios de Notificações ---
// adminRouter.get('/reports/notification-delivery', dateRangeValidator, checkPermission('relatorios:notificacoes:entrega'), requestValidator, adminReportsController.getNotificationDeliveryReport);
// adminRouter.get('/reports/notification-limits', dateRangeValidator, checkPermission('relatorios:notificacoes:limites'), requestValidator, adminReportsController.getNotificationLimitsReport);

// --- Relatórios de Acessibilidade ---
adminRouter.get('/reports/accessibility-usage', checkPermission('relatorios:acessibilidade:acessbilidade'), requestValidator, adminReportsController.getAccessibilityReport);
adminRouter.get('/reports/localization', checkPermission('relatorios:acessibilidade:localizacao'), requestValidator, adminReportsController.getLocalizationReport);

// --- Relatórios de Segurança e Compliance ---
adminRouter.get('/reports/security', dateRangeValidator, checkPermission('relatorios:usuarios:seguranca'), requestValidator, adminReportsController.getSecurityReport);
adminRouter.get('/reports/security-compliance', dateRangeValidator, checkPermission('relatorios:seguranca:compliance'), requestValidator, adminReportsController.getComplianceReport);
adminRouter.get('/reports/security-privacy', dateRangeValidator, checkPermission('relatorios:seguranca:privacidade'), requestValidator, adminReportsController.getPrivacyComplianceReport);
adminRouter.get('/reports/security-sessions', dateRangeValidator, checkPermission('relatorios:seguranca:sessoes'), requestValidator, adminReportsController.getSessionSecurityReport);

// --- Relatórios de Negócios (ESG) ---
adminRouter.get('/reports/esg', dateRangeValidator, checkPermission('relatorios:negocios:asg'), requestValidator, adminReportsController.getEsgReport);

export default adminRouter;
