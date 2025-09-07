export interface IStorageProvider {
  /**
   * Salva um arquivo e retorna a URL pública.
   * @param file - O objeto do arquivo processado pelo multer.
   * @returns Uma promessa que resolve com a URL do arquivo salvo.
   */
  saveFile(file: Express.Multer.File): Promise<string>;

  /**
   * Deleta um arquivo com base em sua URL.
   * @param fileUrl - A URL do arquivo a ser deletado.
   * @returns Uma promessa que resolve quando o arquivo é deletado.
   */
  deleteFile(fileUrl: string): Promise<void>;
}
