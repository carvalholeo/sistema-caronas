// Interfaces para os dados de cada template
export interface IPasswordResetRequestData {
  userName: string;
  resetLink: string;
}

export interface IPasswordResetSuccessData {
  userName: string;
  timestamp: string;
}

export interface ITwoFactorEnabledData {
  userName: string;
}

export interface IRideCancelledData {
  passengerName: string;
  destination: string;
  rideDate: string;
  rideTime: string;
  driverName: string;
  searchLink: string;
}

export interface IRideStatusUpdatedData {
  userName: string;
  destination: string;
  statusMessage: string;
  rideLink: string;
}

export interface INewChatMessageData {
  userName: string;
  senderName: string;
  destination: string;
  chatLink: string;
}

export interface IVehicleStatusUpdatedData {
  driverName: string;
  vehicleInfo: string; // "Marca Modelo"
  plate: string;
  statusMessage: string;
}

export interface IProfileUpdatedData {
  userName: string;
  timestamp: string;
}
