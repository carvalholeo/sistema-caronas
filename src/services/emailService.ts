import fs from 'fs/promises';
import path from 'path';
import handlebars from 'handlebars';
import juice from 'juice';
import { EmailTemplate } from 'types/enums/email';
import { TemplateDataMap } from 'types/types/email';
import logger from 'utils/logger';

export class EmailService {
  private templates: Map<EmailTemplate, handlebars.TemplateDelegate> = new Map();
  private layout!: handlebars.TemplateDelegate;

  constructor() {
    this.initializeTemplates().catch(err =>
      logger.error("Erro ao inicializar templates de e-mail:", err)
    );
  }

  /**
   * Carrega e compila todos os templates de e-mail na memória ao iniciar.
   */
  private async initializeTemplates(): Promise<void> {
    const templatesDir = path.join(__dirname, 'templates', 'emails');

    // Carrega o layout principal
    const layoutPath = path.join(templatesDir, 'templates', 'layouts', 'base.hbs');
    const layoutSource = await fs.readFile(layoutPath, 'utf-8');
    this.layout = handlebars.compile(layoutSource);

    // Carrega os templates individuais
    for (const templateName of Object.values(EmailTemplate)) {
      const filePath = path.join(templatesDir, `${templateName}.hbs`);
      try {
        const source = await fs.readFile(filePath, 'utf-8');
        this.templates.set(templateName, handlebars.compile(source));
      } catch (error) {
        logger.warn(`Template de e-mail não encontrado: ${templateName}.hbs`);
      }
    }
  }

  /**
   * Envia um e-mail transacional usando um template pré-definido.
   * @param template - O nome do template a ser usado (do enum EmailTemplate).
   * @param data - Os dados para preencher o template (com tipo seguro).
   */
  public async prepareEmailTemplate<T extends EmailTemplate>(
    template: T,
    data: TemplateDataMap[T]
  ): Promise<string> {
    const templateFn = this.templates.get(template);
    if (!templateFn) {
      throw new Error(`Template de e-mail "${template}" não foi inicializado.`);
    }

    // Renderiza o corpo do e-mail
    const bodyHtml = templateFn(data);

    // Renderiza o layout completo
    const fullHtml = this.layout({ body: bodyHtml });

    // Injeta o CSS inline para máxima compatibilidade
    return juice(fullHtml);
  }
}

export const emailService = new EmailService();
