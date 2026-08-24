// ============================================================
// CONTROLE GLOBAL DOS TAMPERMONKEYS
// ============================================================

(function () {
    "use strict";

    const CONFIG = {
        SHEET_ID: "1f7deYaMpiG9BSBv89Kd2Bus7mFawv6coudltgSqQZx4",
        GID: "0",

        // Verifica a planilha a cada 30 segundos
        INTERVALO: 30000,

        // Se a internet/Google cair temporariamente,
        // mantém o último estado conhecido.
        MANTER_ULTIMO_ESTADO_EM_ERRO: true
    };

    let ativo = true;
    let verificando = false;

    const AVISO_KEY = "__CONTROLE_GLOBAL_TAMPERMONKEY__";

    function urlPlanilha() {
        return (
            "https://docs.google.com/spreadsheets/d/" +
            CONFIG.SHEET_ID +
            "/gviz/tq?tqx=out:json&gid=" +
            CONFIG.GID +
            "&t=" +
            Date.now()
        );
    }

    async function verificar() {

        if (verificando) {
            return ativo;
        }

        verificando = true;

        try {

            const resposta = await fetch(urlPlanilha(), {
                method: "GET",
                cache: "no-store"
            });

            if (!resposta.ok) {
                throw new Error(
                    `HTTP ${resposta.status}`
                );
            }

            const texto = await resposta.text();

            /*
             * O Google retorna algo parecido com:
             *
             * google.visualization.Query.setResponse({...});
             *
             * Aqui removemos o wrapper.
             */

            const inicio = texto.indexOf("{");
            const fim = texto.lastIndexOf("}");

            if (inicio === -1 || fim === -1) {
                throw new Error(
                    "Resposta da planilha inválida."
                );
            }

            const dados = JSON.parse(
                texto.substring(inicio, fim + 1)
            );

            const linha = dados?.table?.rows?.[0];

            if (!linha) {
                throw new Error(
                    "B1 não foi encontrado."
                );
            }

            // A = índice 0
            // B = índice 1
            const valorB1 =
                linha.c?.[1]?.v ?? "";

            const status =
                String(valorB1)
                    .trim()
                    .toLowerCase();

            ativo = status === "ativo";

            console.log(
                `[CONTROLE GLOBAL] ${ativo ? "ATIVO" : "INATIVO"}`
            );

            if (!ativo) {
                mostrarAviso();
            } else {
                removerAvisoEstado();
            }

            return ativo;

        } catch (erro) {

            console.warn(
                "[CONTROLE GLOBAL] Erro ao verificar planilha:",
                erro
            );

            if (!CONFIG.MANTER_ULTIMO_ESTADO_EM_ERRO) {
                ativo = false;
                mostrarAviso();
            }

            return ativo;

        } finally {
            verificando = false;
        }
    }

    function mostrarAviso() {

        if (sessionStorage.getItem(AVISO_KEY)) {
            return;
        }

        sessionStorage.setItem(
            AVISO_KEY,
            "1"
        );

        alert(
            "Ops! Os DOM do site atualizaram e eu não consigo realizar as ações.\n\n" +
            "Desative este script no Tampermonkey para essa mensagem parar de aparecer."
        );
    }

    function removerAvisoEstado() {
        sessionStorage.removeItem(AVISO_KEY);
    }

    function podeExecutar() {
        return ativo === true;
    }

    // API pública
    window.ControleGlobal = {
        verificar,
        podeExecutar,

        get ativo() {
            return ativo;
        }
    };

    // Primeira verificação
    verificar();

    // Verificação periódica
    setInterval(
        verificar,
        CONFIG.INTERVALO
    );

})();
