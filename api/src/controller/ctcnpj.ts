import { Request, Response } from "express";

// Consulta pelo servidor: não depende do acesso do navegador ao provedor.
export const consultar = async (req: Request, res: Response): Promise<void> => {
  const cnpj = String(req.params.cnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14) {
    res.status(400).json({ error: "Informe um CNPJ com 14 dígitos." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const status = [400, 404, 429].includes(response.status) ? response.status : 502;
      const error = status === 404
        ? "CNPJ não encontrado na base de consulta. Confira o número informado."
        : status === 400
          ? "CNPJ inválido. Confira o número informado."
          : status === 429
            ? "O serviço de CNPJ atingiu o limite de consultas. Tente novamente em alguns instantes."
            : "O serviço de consulta de CNPJ está indisponível. Tente novamente ou preencha os dados manualmente.";
      res.status(status).json({ error });
      return;
    }
    const empresa = await response.json();
    if (!empresa || typeof empresa.razao_social !== "string" || !empresa.razao_social.trim()) {
      res.status(502).json({ error: "O serviço de CNPJ retornou dados incompletos. Tente novamente." });
      return;
    }
    res.json(empresa);
  } catch (error) {
    const expirou = controller.signal.aborted;
    console.error("Falha na consulta de CNPJ:", error);
    res.status(expirou ? 504 : 502).json({ error: expirou
      ? "A consulta de CNPJ demorou demais. Tente novamente ou preencha os dados manualmente."
      : "Não foi possível acessar o serviço de CNPJ. Tente novamente ou preencha os dados manualmente." });
  } finally {
    clearTimeout(timeout);
  }
};
