/**
 * Máscaras e validações brasileiras usadas nos formulários.
 * As funções `mask*` recebem o texto digitado e devolvem o valor formatado;
 * as funções `onlyDigits`/`validar*` trabalham com o valor normalizado que
 * o servidor grava no banco.
 */

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** CPF: 000.000.000-00 · CNPJ: 00.000.000/0000-00 (decide pelo tamanho). */
export function maskDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Aceita fixo (10 dígitos) e celular (11 dígitos), com DDD. */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskCep(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

/** Valor monetário digitado livremente → "1.234,56" (sem o R$). */
export function maskMoney(value: string): string {
  const digits = onlyDigits(value).slice(0, 12);
  if (!digits) return "";
  const cents = Number(digits);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "1.234,56" ou "R$ 1.234,56" → 123456 centavos. */
export function parseMoney(value: string | null | undefined): number {
  const digits = onlyDigits(value);
  return digits ? Number(digits) : 0;
}

/** 123456 centavos → "R$ 1.234,56". */
export function formatMoney(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function validarCpf(value: string | null | undefined): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcular = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) {
      soma += Number(cpf[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
}

export function validarCnpj(value: string | null | undefined): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calcular = (ate: number) => {
    const pesos =
      ate === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, peso, i) => acc + Number(cnpj[i]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcular(12) === Number(cnpj[12]) && calcular(13) === Number(cnpj[13]);
}

/** Valida CPF (11 dígitos) ou CNPJ (14 dígitos). Vazio é considerado válido. */
export function validarDocumento(value: string | null | undefined): boolean {
  const digits = onlyDigits(value);
  if (!digits) return true;
  if (digits.length === 11) return validarCpf(digits);
  if (digits.length === 14) return validarCnpj(digits);
  return false;
}

/** Data de hoje em ISO (YYYY-MM-DD) para inputs `type="date"`. */
export function hojeIso(): string {
  const agora = new Date();
  const fuso = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - fuso).toISOString().slice(0, 10);
}

/** "2026-03-04" → "04/03/2026" sem depender de fuso horário. */
export function formatDateIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
