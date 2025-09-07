import { EmailTemplate } from "types/enums/email";
import { IPasswordResetRequestData, IPasswordResetSuccessData, ITwoFactorEnabledData, IRideCancelledData, IRideStatusUpdatedData, INewChatMessageData, IVehicleStatusUpdatedData, IProfileUpdatedData } from "types/intefaces/email";

export type TemplateDataMap = {
  [EmailTemplate.PasswordResetRequest]: IPasswordResetRequestData;
  [EmailTemplate.PasswordResetSuccess]: IPasswordResetSuccessData;
  [EmailTemplate.TwoFactorEnabled]: ITwoFactorEnabledData;
  [EmailTemplate.RideCancelled]: IRideCancelledData;
  [EmailTemplate.RideStatusUpdated]: IRideStatusUpdatedData;
  [EmailTemplate.NewChatMessage]: INewChatMessageData;
  [EmailTemplate.VehicleStatusUpdated]: IVehicleStatusUpdatedData;
  [EmailTemplate.ProfileUpdated]: IProfileUpdatedData;
};