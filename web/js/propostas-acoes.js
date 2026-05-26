
function getPropostaId() {

    return document.getElementById("editarId")?.value;

}

async function request(url, options = {}) {

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    const text =
        await response.text();

    let data = null;

    try {

        data =
            JSON.parse(text);

    } catch {

        if (!response.ok) {

            throw new Error(
                text ||
                "Erro na requisição"
            );

        }

        return text;

    }

    if (!response.ok) {

        throw new Error(
            data?.error ||
            "Erro na requisição"
        );

    }

    return data;

}

/* ======================================
   GERAR PDF
====================================== */

const btnGerarPdf =
    document.getElementById(
        "btnGerarPdf"
    );

if (btnGerarPdf) {

    btnGerarPdf.addEventListener(
        "click",
        async () => {

            try {

                const id =
                    getPropostaId();

                if (!id) {

                    alert(
                        "Selecione uma proposta."
                    );

                    return;

                }

                btnGerarPdf.disabled = true;

                const data =
                    await request(
                        `${API_URL}/propostas/${id}/pdf`,
                        {
                            method: "POST"
                        }
                    );

                const campoPdf =
                    document.getElementById(
                        "editarPdfUrl"
                    );

                if (campoPdf) {

                    campoPdf.value =
                        data.pdfUrl || "";

                }

                if (campoPdf) {

                    campoPdf.value =
                        data.pdfUrl || "";

                }

                alert(
                    "PDF gerado com sucesso."
                );

                if (data.downloadUrl) {

                    window.open(
                        data.downloadUrl,
                        "_blank"
                    );

                }

            } catch (error) {

                console.error(error);

                alert(
                    error.message
                );

            } finally {

                btnGerarPdf.disabled = false;

            }

        }
    );

}

/* ======================================
   VISUALIZAR PDF
====================================== */

const btnVisualizarPdf =
    document.getElementById(
        "btnVisualizarPdf"
    );

if (btnVisualizarPdf) {

    btnVisualizarPdf.addEventListener(
        "click",
        async () => {

            try {

                const id =
                    getPropostaId();

                if (!id) {

                    alert(
                        "Selecione uma proposta."
                    );

                    return;

                }

                window.open(
                    `${API_URL}/propostas/${id}/download`,
                    "_blank"
                );

            } catch (error) {

                console.error(error);

                alert(
                    error.message
                );

            }

        }
    );

}

/* ======================================
   WHATSAPP
====================================== */

const btnWhatsapp =
    document.getElementById(
        "btnWhatsapp"
    );

if (btnWhatsapp) {

    btnWhatsapp.addEventListener(
        "click",
        async () => {

            try {

                const id =
                    getPropostaId();

                if (!id) {

                    alert(
                        "Selecione uma proposta."
                    );

                    return;

                }

                btnWhatsapp.disabled = true;

                const data =
                    await request(
                        `${API_URL}/propostas/${id}/whatsapp`,
                        {
                            method: "POST"
                        }
                    );

                if (
                    data.whatsappUrl
                ) {

                    window.open(
                        data.whatsappUrl,
                        "_blank"
                    );

                } else {

                    alert(
                        "Link do WhatsApp não retornado."
                    );

                }

            } catch (error) {

                console.error(error);

                alert(
                    error.message
                );

            } finally {

                btnWhatsapp.disabled = false;

            }

        }
    );

}

/* ======================================
   EMAIL
====================================== */

const btnEmail =
    document.getElementById(
        "btnEmail"
    );

if (btnEmail) {

    btnEmail.addEventListener(
        "click",
        async () => {

            try {

                const id =
                    getPropostaId();

                if (!id) {

                    alert(
                        "Selecione uma proposta."
                    );

                    return;

                }

                btnEmail.disabled = true;

                const data =
                    await request(
                        `${API_URL}/propostas/${id}/email`,
                        {
                            method: "POST"
                        }
                    );

                alert(
                    data.message ||
                    "E-mail enviado com sucesso."
                );

            } catch (error) {

                console.error(error);

                alert(
                    error.message
                );

            } finally {

                btnEmail.disabled = false;

            }

        }
    );

}

/* ======================================
   TEMPLATE
====================================== */

async function carregarTemplates() {

    const select =
        document.getElementById(
            "editarTemplateId"
        );

    if (!select) return;

    try {

        const templates =
            await request(
                `${API_URL}/templates`
            );

        select.innerHTML =
            '<option value="">Selecione...</option>';

        templates.forEach(
            template => {

                select.innerHTML += `
                    <option value="${template.templateid}">
                        ${template.nome}
                    </option>
                `;

            }
        );

    } catch (error) {

        console.error(
            "Erro templates:",
            error
        );

    }

}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        carregarTemplates();

    }
);