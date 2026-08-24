// ============================================================
// CONTROLE GLOBAL DOS TAMPERMONKEYS
// ============================================================

(function () {
    "use strict";

    const CONFIG = {

        // =====================================================
        // PLANILHA
        // =====================================================

        SHEET_ID:
            "1f7deYaMpiG9BSBv89Kd2Bus7mFawv6coudltgSqQZx4",

        GID: "0",

        // =====================================================
        // CONFIGURAÇÕES
        // =====================================================

        // Verifica a planilha a cada 30 segundos
        INTERVALO: 30000,

        // Se Google/internet falhar temporariamente,
        // mantém o último estado conhecido.
        MANTER_ULTIMO_ESTADO_EM_ERRO: true

    };


    // =========================================================
    // ESTADO
    // =========================================================

    // Começa BLOQUEADO.
    // Só libera depois que confirmar "Ativo" na planilha.
    let ativo = false;

    let estadoConfirmado = false;

    let verificando = false;

    const AVISO_KEY =
        "__CONTROLE_GLOBAL_TAMPERMONKEY__";


    // =========================================================
    // URL DA PLANILHA
    // =========================================================

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


    // =========================================================
    // VERIFICAR PLANILHA
    // =========================================================

    async function verificar() {

        if (verificando) {
            return ativo;
        }

        verificando = true;

        try {

            console.log(
                "[CONTROLE GLOBAL] Verificando planilha..."
            );


            const resposta = await fetch(
                urlPlanilha(),
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


            if (!resposta.ok) {

                throw new Error(
                    `HTTP ${resposta.status}`
                );

            }


            const texto =
                await resposta.text();


            // =================================================
            // EXTRAI JSON DO GOOGLE
            // =================================================

            const inicio =
                texto.indexOf("{");

            const fim =
                texto.lastIndexOf("}");


            if (
                inicio === -1 ||
                fim === -1
            ) {

                throw new Error(
                    "Resposta da planilha inválida."
                );

            }


            const dados =
                JSON.parse(
                    texto.substring(
                        inicio,
                        fim + 1
                    )
                );


            // =================================================
            // PRIMEIRA LINHA DA PLANILHA
            // =================================================

            const linha =
                dados?.table?.rows?.[0];


            if (!linha) {

                throw new Error(
                    "B1 não encontrado."
                );

            }


            // =================================================
            // B1
            // =================================================

            const valorB1 =
                linha.c?.[1]?.v ?? "";


            const status =
                String(valorB1)
                    .trim()
                    .toLowerCase();


            // =================================================
            // ATUALIZA ESTADO
            // =================================================

            if (status === "ativo") {

                ativo = true;

                estadoConfirmado = true;

                removerAvisoEstado();

                console.log(
                    "%c[CONTROLE GLOBAL] ATIVO",
                    "color: green; font-weight: bold;"
                );

            }

            else {

                ativo = false;

                estadoConfirmado = true;

                mostrarAviso();

                console.warn(
                    "[CONTROLE GLOBAL] INATIVO"
                );

            }


            return ativo;


        }

        catch (erro) {


            console.warn(
                "[CONTROLE GLOBAL] Erro ao verificar planilha:",
                erro
            );


            // =================================================
            // FALHA TEMPORÁRIA
            // =================================================

            if (
                !CONFIG.MANTER_ULTIMO_ESTADO_EM_ERRO
            ) {

                ativo = false;

                mostrarAviso();

            }


            return ativo;


        }

        finally {

            verificando = false;

        }

    }


    // =========================================================
    // AVISO
    // =========================================================

    function mostrarAviso() {

        if (
            sessionStorage.getItem(
                AVISO_KEY
            )
        ) {

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


    // =========================================================
    // REMOVE ESTADO DO AVISO
    // =========================================================

    function removerAvisoEstado() {

        sessionStorage.removeItem(
            AVISO_KEY
        );

    }


    // =========================================================
    // PODE EXECUTAR?
    // =========================================================

    function podeExecutar() {

        return (
            estadoConfirmado &&
            ativo === true
        );

    }


    // =========================================================
    // API GLOBAL
    // =========================================================

    window.ControleGlobal = {

        verificar,

        podeExecutar,

        get ativo() {

            return ativo;

        },

        get confirmado() {

            return estadoConfirmado;

        }

    };


    // =========================================================
    // PRIMEIRA VERIFICAÇÃO
    // =========================================================

    verificar();


    // =========================================================
    // VERIFICAÇÃO AUTOMÁTICA
    // =========================================================

    setInterval(
        verificar,
        CONFIG.INTERVALO
    );


})();
