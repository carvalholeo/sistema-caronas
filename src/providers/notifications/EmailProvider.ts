import nodemailer from 'nodemailer';
import { INotificationProvider } from './INotificationProvider';
import { INotificationPayload, INotificationSubscription } from 'types';
import logger from 'utils/logger';

export class EmailProvider implements INotificationProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    // As credenciais DEVEM vir de variáveis de ambiente.
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  public async send(subscription: INotificationSubscription, payload: INotificationPayload): Promise<void> {
    if (!subscription.destination) {
      logger.warn(`Tentativa de envio de e-mail sem endereço para o utilizador ${subscription.user}`);
      return;
    }

    const mailOptions = {
      from: `"Nome da App" <${process.env.SMTP_FROM_EMAIL}>`,
      to: subscription.destination,
      subject: payload.title,
      text: payload.body,
      html: `
        <div style="font-family: sans-serif;">
          <h1>${payload.title}</h1>
          <p>${payload.body}</p>
          ${payload.url ? `<p><a href="${payload.url}">Ver detalhes</a></p>` : ''}
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error(`Erro ao enviar e-mail para ${subscription.destination}:`, error);
    }
  }
}
