import { Router, Request, Response } from 'express';
import { DataReportModel } from '../models/dataReport';
import { verifyReportValidator } from '../middlewares/validators/admin/privacy';

const publicRouter = Router();

// Rota pública para verificar a integridade de um relatório de dados
publicRouter.get('/reports/verify/:hash', verifyReportValidator, async (req: Request, res: Response) => {
    try {
        const report = await DataReportModel.findOne({ hash: req.params.hash });
        if (!report) {
            return res.status(404).json({ valid: false, message: 'Relatório não encontrado ou inválido.' });
        }
        return res.status(200).json({
            valid: true,
            issuedAt: report.createdAt,
            includedDataPoints: report.includedDataPoints
        });
    } catch (error: Error | any) {
        return res.status(500).json({ message: 'Erro ao verificar o relatório.', error: error.message });
    }
});

export default publicRouter;
