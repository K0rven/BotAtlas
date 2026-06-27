// atlas-form.js
// Lógica de validação, montagem de payload e envio do formulário do Atlas
// para o webhook do n8n. As funções de domínio (validateAtlasForm,
// buildAtlasPayload, submitAtlasForm) são puras / sem dependência de DOM
// para serem testáveis isoladamente. initAtlasForm() é a camada fina que
// liga essa lógica aos elementos da página.

export const N8N_WEBHOOK_URL =
  'http://localhost:5678/webhook-test/formulario-atlas';

const VALID_SEGMENTS = [
  'clinica',
  'imobiliaria',
  'escritorio',
  'ecommerce',
  'educacao',
  'outro',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida os campos do formulário.
 * @param {object} data - { name, company, whatsapp, email, segment, message }
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
export function validateAtlasForm(data) {
  const errors = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Informe seu nome completo.';
  }

  if (!data.company || !data.company.trim()) {
    errors.company = 'Informe o nome da empresa/negócio.';
  }

  const digits = (data.whatsapp || '').replace(/\D/g, '');
  if (!data.whatsapp || !data.whatsapp.trim()) {
    errors.whatsapp = 'Informe o WhatsApp.';
  } else if (digits.length < 10) {
    errors.whatsapp = 'WhatsApp inválido.';
  }

  if (!data.email || !data.email.trim()) {
    errors.email = 'Informe o e-mail.';
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = 'E-mail inválido.';
  }

  if (!data.segment || !data.segment.trim()) {
    errors.segment = 'Selecione um segmento.';
  } else if (!VALID_SEGMENTS.includes(data.segment)) {
    errors.segment = 'Segmento inválido.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Monta o payload que será enviado ao n8n a partir dos dados do formulário.
 * @param {object} data
 * @returns {object}
 */
export function buildAtlasPayload(data) {
  return {
    name: (data.name || '').trim(),
    company: (data.company || '').trim(),
    whatsapp: (data.whatsapp || '').trim(),
    email: (data.email || '').trim(),
    segment: data.segment,
    message: (data.message || '').trim(),
    source: 'site-atlas',
  };
}

/**
 * Envia o payload ao webhook do n8n.
 * @param {object} data - dados crus do formulário
 * @param {typeof fetch} fetchImpl - injeção do fetch (testabilidade)
 * @returns {Promise<{ success: boolean, status?: number, error?: string }>}
 */
export async function submitAtlasForm(data, fetchImpl = fetch) {
  const payload = buildAtlasPayload(data);

  try {
    const response = await fetchImpl(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, status: response.status };
    }

    return { success: true, status: response.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Liga a lógica acima aos elementos reais da página (DOM).
 * Mantém também a máscara de WhatsApp que já existia no HTML original.
 */
export function initAtlasForm() {
  const form = document.getElementById('atlasForm');
  const whatsappInput = document.getElementById('whatsapp');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btn-text');
  const errorBox = document.getElementById('form-error');

  if (!form) return;

  whatsappInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length <= 2) {
      v = v.replace(/^(\d{0,2})/, '($1');
    } else if (v.length <= 7) {
      v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else {
      v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
    }
    e.target.value = v;
  });

  function shake(el) {
    el.style.borderColor = '#ff4d6d';
    el.style.boxShadow = '0 0 0 3px rgba(255,77,109,0.15)';
    el.focus();
    setTimeout(() => {
      el.style.borderColor = '';
      el.style.boxShadow = '';
    }, 2000);
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = 'block';
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.style.display = 'none';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const data = {
      name: document.getElementById('name').value,
      company: document.getElementById('company').value,
      whatsapp: document.getElementById('whatsapp').value,
      email: document.getElementById('email').value,
      segment: document.getElementById('segment').value,
      message: document.getElementById('message').value,
    };

    const { valid, errors } = validateAtlasForm(data);

    if (!valid) {
      const firstInvalidField = Object.keys(errors)[0];
      const el = document.getElementById(firstInvalidField);
      if (el) shake(el);
      return;
    }

    submitBtn.disabled = true;
    btnText.textContent = 'Enviando...';

    const result = await submitAtlasForm(data);

    if (result.success) {
      document.getElementById('form-fields').style.display = 'none';
      document.getElementById('form-success').classList.add('active');
    } else {
      submitBtn.disabled = false;
      btnText.textContent = '💬 Falar com Especialista';
      showError(
        'Não foi possível enviar agora. Tente novamente em instantes.'
      );
    }
  });
}