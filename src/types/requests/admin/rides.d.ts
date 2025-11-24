// Adicione este tipo para a rota de listagem de caronas do admin
export interface IAdminListRidesQuery {
  status?: RideStatus;
  driverId?: string;
  startDate?: string; // Formato ISO: 'YYYY-MM-DD'
  endDate?: string;   // Formato ISO: 'YYYY-MM-DD'
  originText?: string;
  destinationText?: string;
  isRecurrent?: 'true' | 'false';
  sortBy?: 'startDate' | 'originText' | 'destinationText';
  sortOrder?: 'asc' | 'desc';
}