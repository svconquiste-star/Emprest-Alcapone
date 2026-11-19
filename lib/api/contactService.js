import prisma from '../db';
import { submitContactSchema } from '../validation/schemas';

export async function createContact(data, ipAddress, userAgent) {
  try {
    const validated = submitContactSchema.parse(data);

    const contact = await prisma.contact.create({
      data: {
        nomeEmpresa: 'ALCAPONE', // Sempre fixo
        nome: validated.nome,
        telefone: validated.telefone,
        email: validated.email || null,
        cidade: validated.cidade,
        deviceType: validated.deviceType || null,
        operatingSystem: validated.operatingSystem || null,
        whatsappLink: validated.whatsappLink || null,
        ipAddress,
        userAgent,
      },
    });

    return contact;
  } catch (error) {
    if (error.name === 'ZodError') {
      throw error;
    }
    console.error('[contactService.createContact] Error:', error);
    throw new Error('Erro ao salvar contato no banco de dados');
  }
}
