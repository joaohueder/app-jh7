/**
 * Cliente de IA genérico, compatível com endpoints no formato OpenAI
 * (`POST {base_url}/chat/completions`). Funciona com OpenAI, OpenRouter,
 * Groq, LM Studio, Ollama (modo OpenAI) e outros provedores que seguem
 * o mesmo contrato.
 */

export type AiConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
};

export type AiChatResult =
  | { ok: true; reply: string; latencyMs: number }
  | { ok: false; message: string };

export type AiModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; message: string };

const TIMEOUT_MS = 30_000;

function normalizarBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

type ChatCompletionResponse = {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string; type?: string };
};

/** Resumo curto e seguro do corpo bruto, para mensagens de diagnóstico. */
function amostraTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").slice(0, 300);
}

/** Envia uma mensagem simples e devolve a resposta do modelo. */
export async function chatAi(
  config: AiConfig,
  prompt: string,
  opcoes?: { maxTokens?: number },
): Promise<AiChatResult> {
  const url = `${normalizarBaseUrl(config.baseUrl)}/chat/completions`;
  const inicio = Date.now();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: opcoes?.maxTokens ?? 1000,
        temperature: 0,
        stream: false,
      }),
    });

    // Lemos como texto primeiro: endpoints com URL errada devolvem HTML,
    // e o JSON.parse falharia em silêncio, escondendo a causa real.
    const bruto = await resposta.text();
    let corpo: ChatCompletionResponse | null = null;
    try {
      corpo = JSON.parse(bruto) as ChatCompletionResponse;
    } catch {
      corpo = null;
    }

    if (!resposta.ok || corpo?.error) {
      const detalhe = corpo?.error?.message;
      let message: string;

      if (resposta.status === 401 || resposta.status === 403) {
        message = "Chave de API inválida ou sem permissão para este modelo.";
      } else if (resposta.status === 404) {
        message =
          "Endpoint ou modelo não encontrado. Confira a URL base e o nome do modelo.";
      } else if (resposta.status === 429) {
        message =
          "Limite de uso atingido no provedor. Aguarde alguns minutos e teste novamente.";
      } else {
        message = `O endpoint respondeu com status ${resposta.status}.`;
      }

      if (detalhe) {
        message += ` Detalhe do provedor: ${detalhe}`;
      } else if (corpo === null && bruto.trim()) {
        message += ` Resposta bruta: ${amostraTexto(bruto)}`;
      }
      return { ok: false, message };
    }

    const choice = corpo?.choices?.[0];
    const reply = choice?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      // Sem texto na resposta: HTML de uma URL errada, stream inesperado,
      // ou modelo de raciocínio que estourou o limite de tokens sem escrever.
      if (corpo === null) {
        if (/<(!doctype|html)/i.test(bruto)) {
          return {
            ok: false,
            message:
              "A URL não aponta para uma API JSON — veio uma página HTML. Confira a URL base (deve ser só a parte antes de /chat/completions, ex.: https://api.openai.com/v1).",
          };
        }
        if (bruto.includes("data:")) {
          return {
            ok: false,
            message:
              "O endpoint respondeu em streaming (SSE), não em JSON. Confira se a URL base está correta.",
          };
        }
        return {
          ok: false,
          message:
            "O endpoint respondeu fora do formato JSON esperado." +
            (bruto.trim() ? ` Resposta bruta: ${amostraTexto(bruto)}` : " A resposta veio vazia."),
        };
      }
      if (choice?.finish_reason === "length") {
        return {
          ok: false,
          message:
            "O modelo usou todos os tokens sem produzir texto (comum em modelos de raciocínio). Escolha um modelo de chat ou aumente o limite no provedor.",
        };
      }
      return {
        ok: false,
        message:
          "O endpoint respondeu sem conteúdo de texto. Verifique se o modelo informado é um modelo de chat." +
          (bruto.trim() ? ` Resposta bruta: ${amostraTexto(bruto)}` : ""),
      };
    }

    return {
      ok: true,
      reply: reply.trim(),
      latencyMs: Date.now() - inicio,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        ok: false,
        message: `Tempo esgotado (${TIMEOUT_MS / 1000}s) esperando o endpoint. Verifique a URL e a conexão.`,
      };
    }
    return {
      ok: false,
      message: "Não foi possível conectar ao endpoint. Verifique a URL e a internet do servidor.",
    };
  }
}

/** Teste de conexão: prompt mínimo e resposta curta. */
export function testarConexaoIa(config: AiConfig): Promise<AiChatResult> {
  return chatAi(config, "Responda com exatamente duas palavras: conexão OK");
}

/**
 * Lista os modelos disponíveis no endpoint (`GET {base}/models`, formato
 * OpenAI — suportado por OpenAI, OpenRouter, Groq, Ollama, LM Studio...).
 */
export async function listarModelosIa(
  baseUrl: string,
  apiKey?: string,
): Promise<AiModelsResult> {
  const url = `${normalizarBaseUrl(baseUrl)}/models`;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const resposta = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const corpo = (await resposta
      .json()
      .catch(() => null)) as { data?: { id?: string }[]; error?: { message?: string } } | null;

    if (!resposta.ok || corpo?.error) {
      return {
        ok: false,
        message:
          corpo?.error?.message ??
          `O endpoint respondeu com status ${resposta.status} ao listar modelos.`,
      };
    }

    const modelos = (corpo?.data ?? [])
      .map((item) => item?.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .sort((a, b) => a.localeCompare(b));

    if (!modelos.length) {
      return { ok: false, message: "O endpoint não devolveu nenhum modelo." };
    }

    return { ok: true, models: modelos };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        ok: false,
        message: `Tempo esgotado (${TIMEOUT_MS / 1000}s) ao listar modelos.`,
      };
    }
    return {
      ok: false,
      message: "Não foi possível listar os modelos. Verifique a URL e a internet do servidor.",
    };
  }
}
