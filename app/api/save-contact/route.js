import { NextResponse } from 'next/server';
import { createContact } from '@/lib/api/contactService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = (forwarded ? forwarded.split(',')[0].trim() : null) ||
                      request.headers.get('x-real-ip') ||
                      request.headers.get('x-client-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent');

    const contact = await createContact(body, ipAddress, userAgent);

    return NextResponse.json({ success: true, contactId: contact.id }, { status: 201 });
  } catch (error) {
    const issues = error?.issues || error?.errors;
    if (error.name === 'ZodError' && issues) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        },
        { status: 400 }
      );
    }

    console.error('[API /save-contact] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar dados' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
