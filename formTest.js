import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateAtlasForm,
  buildAtlasPayload,
  submitAtlasForm,
} from './atlas-form.js';

const validData = {
  name: 'Daniel Gabriel',
  company: 'Korven',
  whatsapp: '(61) 9 9999-0000',
  email: 'daniel@korven.dev',
  segment: 'escritorio',
  message: 'Quero automatizar o atendimento.',
};

describe('validateAtlasForm', () => {
  it('retorna válido quando todos os campos obrigatórios estão preenchidos corretamente', () => {
    const result = validateAtlasForm(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('aceita o envio sem "message", pois é opcional', () => {
    const { message, ...rest } = validData;
    const result = validateAtlasForm(rest);
    expect(result.valid).toBe(true);
  });

  it.each([
    ['name', { ...validData, name: '' }],
    ['company', { ...validData, company: '  ' }],
    ['whatsapp', { ...validData, whatsapp: '' }],
    ['email', { ...validData, email: '' }],
    ['segment', { ...validData, segment: '' }],
  ])('marca "%s" como inválido quando está vazio', (field, data) => {
    const result = validateAtlasForm(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty(field);
  });

  it('rejeita e-mail com formato inválido', () => {
    const result = validateAtlasForm({ ...validData, email: 'nao-e-email' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('email');
  });

  it('rejeita whatsapp com menos de 10 dígitos', () => {
    const result = validateAtlasForm({ ...validData, whatsapp: '(61) 999' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('whatsapp');
  });

  it('rejeita segmento fora da lista de opções permitidas', () => {
    const result = validateAtlasForm({ ...validData, segment: 'inexistente' });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveProperty('segment');
  });

  it('acumula mais de um erro quando vários campos obrigatórios faltam', () => {
    const result = validateAtlasForm({ ...validData, name: '', email: '' });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(
      expect.arrayContaining(['name', 'email'])
    );
  });
});

describe('buildAtlasPayload', () => {
  it('monta o payload com os campos esperados, removendo espaços extras', () => {
    const payload = buildAtlasPayload({
      ...validData,
      name: '  Daniel Gabriel  ',
    });

    expect(payload).toEqual({
      name: 'Daniel Gabriel',
      company: 'Korven',
      whatsapp: '(61) 9 9999-0000',
      email: 'daniel@korven.dev',
      segment: 'escritorio',
      message: 'Quero automatizar o atendimento.',
      source: 'site-atlas',
    });
  });

  it('envia message como string vazia quando não preenchida', () => {
    const { message, ...rest } = validData;
    const payload = buildAtlasPayload(rest);
    expect(payload.message).toBe('');
  });
});

describe('submitAtlasForm', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it('faz POST em JSON para a URL do webhook do n8n com o payload correto', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await submitAtlasForm(validData, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe(
      'https://danielg2602.app.n8n.cloud/webhook-test/formulario-atlas'
    );
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual(buildAtlasPayload(validData));
  });

  it('resolve com sucesso quando o n8n responde 2xx', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const result = await submitAtlasForm(validData, fetchMock);
    expect(result.success).toBe(true);
  });

  it('retorna falha quando o n8n responde status de erro', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const result = await submitAtlasForm(validData, fetchMock);
    expect(result.success).toBe(false);
  });

  it('retorna falha quando a requisição lança uma exceção de rede', async () => {
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    const result = await submitAtlasForm(validData, fetchMock);
    expect(result.success).toBe(false);
  });
});